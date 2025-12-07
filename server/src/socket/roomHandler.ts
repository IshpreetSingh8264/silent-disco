import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import YTMusic from 'ytmusic-api';
import { redis } from '../services/redis';

const ytmusic = new YTMusic();
ytmusic.initialize();

export const setupRoomHandlers = (io: Server, prisma: PrismaClient) => {
    const checkQueueHealth = async (roomCode: string, roomId: string) => {
        console.log(`[SmartQueue] Checking health for room ${roomCode}`);
        // Count unplayed items
        const unplayedCount = await prisma.roomQueue.count({
            where: { roomId, isPlayed: false } as any
        });

        console.log(`[SmartQueue] Unplayed count: ${unplayedCount}`);

        if (unplayedCount < 3) {
            // Need to add more songs
            console.log('[SmartQueue] Queue low, fetching recommendations...');
            // Get the last track in the queue or the current playing track to base recommendations on
            const lastItem = await prisma.roomQueue.findFirst({
                where: { roomId },
                orderBy: { order: 'desc' },
                include: { track: true }
            });

            let seedTrackId = lastItem?.track?.pipedId;

            if (!seedTrackId) {
                // Fallback to current room track
                const room = await prisma.room.findUnique({ where: { id: roomId } });
                seedTrackId = room?.currentTrackId || undefined;
            }

            console.log(`[SmartQueue] Seed Track ID: ${seedTrackId}`);

            if (seedTrackId) {
                try {
                    // Check cache for recommendations
                    const cacheKey = `recommendations:${seedTrackId}`;
                    let recommendations: any[] = [];
                    const cached = await redis.get(cacheKey);

                    if (cached) {
                        console.log('[SmartQueue] Cache hit');
                        recommendations = JSON.parse(cached);
                    } else {
                        console.log('[SmartQueue] Cache miss, fetching from YTMusic');
                        const searchResults = await ytmusic.search(lastItem?.track?.title || 'trending music');
                        recommendations = searchResults.filter((item: any) => item.videoId && item.videoId !== seedTrackId).slice(0, 5);
                        await redis.set(cacheKey, JSON.stringify(recommendations), 3600);
                    }

                    console.log(`[SmartQueue] Found ${recommendations.length} recommendations`);

                    // Add top 3 unique songs
                    let addedCount = 0;
                    for (const rec of recommendations) {
                        if (addedCount >= 3) break;

                        // Check if already in queue (unplayed)
                        const exists = await prisma.roomQueue.findFirst({
                            where: {
                                roomId,
                                track: { pipedId: rec.videoId },
                                isPlayed: false
                            } as any
                        });

                        if (!exists) {
                            // Ensure track exists
                            let dbTrack = await prisma.track.findUnique({ where: { pipedId: rec.videoId } });
                            if (!dbTrack) {
                                dbTrack = await prisma.track.create({
                                    data: {
                                        pipedId: rec.videoId,
                                        title: rec.name || rec.title,
                                        artist: rec.artist?.name || rec.uploaderName || 'Unknown',
                                        duration: rec.duration || 0, // Need to parse duration if string
                                        thumbnailUrl: rec.thumbnails?.[rec.thumbnails.length - 1]?.url || rec.thumbnail
                                    }
                                });
                            }

                            // Get new order
                            const lastOrder = await prisma.roomQueue.findFirst({
                                where: { roomId },
                                orderBy: { order: 'desc' }
                            });
                            const newOrder = (lastOrder?.order || 0) + 1;

                            await prisma.roomQueue.create({
                                data: {
                                    roomId,
                                    trackId: dbTrack.id,
                                    order: newOrder,
                                    addedBy: 'SYSTEM'
                                }
                            });
                            addedCount++;
                        }
                    }

                    console.log(`[SmartQueue] Added ${addedCount} new tracks`);

                    if (addedCount > 0) {
                        broadcastQueue(roomCode, roomId);
                    }

                } catch (err) {
                    console.error('Smart Queue Error:', err);
                }
            }
        }
    };

    const broadcastQueue = async (roomCode: string, roomId: string) => {
        const mappedQueue = await getRoomQueue(roomId);
        io.to(roomCode).emit('queue_update', mappedQueue);
    };

    const getRoomQueue = async (roomId: string) => {
        const queueItems = await prisma.roomQueue.findMany({
            where: { roomId },
            include: { track: true },
            orderBy: { order: 'asc' }
        });

        return queueItems.map(item => ({
            ...item.track,
            url: `/api/music/streams/${item.track.pipedId}`,
            thumbnail: item.track.thumbnailUrl,
            uploaderName: item.track.artist,
            queueId: item.id,
            isPlayed: (item as any).isPlayed
        }));
    };

    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on('join_room', async ({ roomCode }) => {
            console.log(`[DEBUG] join_room received: Code=${roomCode}, Socket=${socket.id}`);

            try {
                // Authenticate user from token
                const token = socket.handshake.auth.token;
                if (!token) {
                    console.error('No token provided for socket connection');
                    socket.emit('auth_error', 'No authentication token provided.');
                    return;
                }

                let userId: string;
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
                    userId = decoded.userId;
                } catch (err) {
                    console.error('Invalid token for socket connection:', err);
                    socket.emit('auth_error', 'Invalid authentication token.');
                    return;
                }

                // Store session data for disconnect handling
                socket.data.roomCode = roomCode;
                socket.data.userId = userId;

                const room = await prisma.room.findUnique({ where: { code: roomCode } });
                if (!room) {
                    socket.emit('room_error', 'Room not found.');
                    return;
                }

                await socket.join(roomCode);
                console.log(`User ${userId} joined room ${roomCode}`);

                // Check if user is already a member
                const existingMember = await prisma.roomMember.findFirst({
                    where: { roomId: room.id, userId }
                });

                if (!existingMember) {
                    await prisma.roomMember.create({
                        data: { userId, roomId: room.id }
                    });
                }

                // Fetch updated member list with user details
                const members = await prisma.roomMember.findMany({
                    where: { roomId: room.id },
                    include: { user: { select: { id: true, username: true, email: true } } }
                });

                console.log(`Broadcasting ${members.length} members to room ${roomCode}`);

                // Broadcast updated member list to ALL in room
                io.to(roomCode).emit('members_update', members.map(m => m.user));

                // Explicitly send to the joining user as well to ensure they get it
                socket.emit('members_update', members.map(m => m.user));

                // Check if user is host
                console.log(`[DEBUG] Checking Host: RoomHost=${room.hostId}, User=${userId}`);
                if (room.hostId === userId) {
                    console.log(`[DEBUG] User ${userId} IS HOST`);
                    socket.emit('is_host', true);
                } else {
                    console.log(`[DEBUG] User ${userId} IS NOT HOST`);
                    socket.emit('is_host', false);
                }

                // Send current room state to the NEW joiner only
                const currentRoomState = await prisma.room.findUnique({
                    where: { id: room.id },
                    include: { host: { select: { username: true } } }
                });

                if (currentRoomState) {
                    const track = currentRoomState.currentTrackId ? await prisma.track.findUnique({ where: { pipedId: currentRoomState.currentTrackId } }) : null;

                    // Fetch Queue
                    const queueItems = await prisma.roomQueue.findMany({
                        where: { roomId: room.id },
                        include: { track: true },
                        orderBy: { order: 'asc' }
                    });
                    const mappedQueue = queueItems.map(item => ({
                        ...item.track,
                        url: `/api/music/streams/${item.track.pipedId}`,
                        thumbnail: item.track.thumbnailUrl,
                        uploaderName: item.track.artist,
                        queueId: item.id,
                        isPlayed: item.isPlayed
                    }));

                    socket.emit('sync_state', {
                        isPlaying: currentRoomState.isPlaying,
                        position: currentRoomState.position,
                        track: track ? { ...track, url: `/api/music/streams/${track.pipedId}` } : null,
                        queue: mappedQueue,
                        timestamp: Date.now()
                    });
                }

            } catch (error) {
                console.error('Error joining room:', error);
            }
        });

        socket.on('leave_room', async ({ roomCode, userId }) => {
            try {
                const room = await prisma.room.findUnique({ where: { code: roomCode } });
                if (!room) return;

                socket.leave(roomCode);
                console.log(`User ${userId} left room ${roomCode}`);

                // Remove member
                await prisma.roomMember.deleteMany({
                    where: { roomId: room.id, userId }
                });

                // Broadcast updated member list
                const members = await prisma.roomMember.findMany({
                    where: { roomId: room.id },
                    include: { user: { select: { id: true, username: true, email: true } } }
                });
                io.to(roomCode).emit('members_update', members.map(m => m.user));

            } catch (error) {
                console.error('Error leaving room:', error);
            }
        });

        socket.on('request_sync', async ({ roomCode }) => {
            try {
                const room = await prisma.room.findUnique({ where: { code: roomCode } });
                if (!room) return;

                const currentRoomState = await prisma.room.findUnique({
                    where: { id: room.id },
                    include: { host: { select: { username: true } } }
                });

                if (currentRoomState) {
                    const track = currentRoomState.currentTrackId ? await prisma.track.findUnique({ where: { pipedId: currentRoomState.currentTrackId } }) : null;

                    // Fetch Queue
                    const queueItems = await prisma.roomQueue.findMany({
                        where: { roomId: room.id },
                        include: { track: true },
                        orderBy: { order: 'asc' }
                    });
                    const mappedQueue = queueItems.map(item => ({
                        ...item.track,
                        url: `/api/music/streams/${item.track.pipedId}`,
                        thumbnail: item.track.thumbnailUrl,
                        uploaderName: item.track.artist,
                        queueId: item.id,
                        isPlayed: item.isPlayed
                    }));

                    socket.emit('sync_state', {
                        isPlaying: currentRoomState.isPlaying,
                        position: currentRoomState.position,
                        track: track ? { ...track, url: `/api/music/streams/${track.pipedId}` } : null,
                        queue: mappedQueue,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.error('Error syncing state:', error);
            }
        });

        socket.on('play', async ({ roomCode, track, position }) => {
            const room = await prisma.room.findUnique({
                where: { code: roomCode },
                include: { members: true }
            });
            if (!room) return;

            const userId = socket.data.userId;
            const member = room.members.find(m => m.userId === userId);
            const isHost = room.hostId === userId;

            if (!isHost && !member?.canControlPlayback) {
                console.log(`[Permission Denied] User ${userId} tried to play. RoomHost: ${room.hostId}, IsHost: ${isHost}, CanControl: ${member?.canControlPlayback}`);
                return;
            }

            // Broadcast play event to EVERYONE including sender
            io.to(roomCode).emit('play', { track, position });

            // Update DB
            // Ensure track exists in DB first (it should)
            let dbTrack = await prisma.track.findUnique({ where: { pipedId: track.pipedId } });
            if (!dbTrack) {
                dbTrack = await prisma.track.create({
                    data: {
                        pipedId: track.pipedId,
                        title: track.title,
                        artist: track.artist || track.uploaderName || 'Unknown',
                        duration: track.duration || 0,
                        thumbnailUrl: track.thumbnail
                    }
                });
            }

            await prisma.room.update({
                where: { id: room.id },
                data: {
                    isPlaying: true,
                    currentTrackId: track.pipedId,
                    position: position,
                    updatedAt: new Date()
                }
            });

            // Mark as played in queue if exists
            if ((track as any).queueId) {
                await prisma.roomQueue.update({
                    where: { id: (track as any).queueId },
                    data: { isPlayed: true }
                });
            }

            // Trigger Smart Queue Check
            checkQueueHealth(roomCode, room.id);
            broadcastQueue(roomCode, room.id);
        });

        socket.on('pause', async ({ roomCode, position }) => {
            const room = await prisma.room.findUnique({
                where: { code: roomCode },
                include: { members: true }
            });
            if (!room) return;

            const userId = socket.data.userId;
            const member = room.members.find(m => m.userId === userId);
            const isHost = room.hostId === userId;

            if (!isHost && !member?.canControlPlayback) return;

            io.to(roomCode).emit('pause', { position });

            await prisma.room.update({
                where: { id: room.id },
                data: { isPlaying: false, position }
            });
        });

        socket.on('seek', async ({ roomCode, position }) => {
            const room = await prisma.room.findUnique({
                where: { code: roomCode },
                include: { members: true }
            });
            if (!room) return;

            const userId = socket.data.userId;
            const member = room.members.find(m => m.userId === userId);
            const isHost = room.hostId === userId;

            if (!isHost && !member?.canControlPlayback) return;

            io.to(roomCode).emit('seek', { position });

            await prisma.room.update({
                where: { id: room.id },
                data: { position }
            });
        });

        socket.on('queue_add', async ({ roomCode, track }) => {
            const room = await prisma.room.findUnique({
                where: { code: roomCode },
                include: { members: true }
            });
            if (!room) return;

            const userId = socket.data.userId;
            const member = room.members.find(m => m.userId === userId);
            const isHost = room.hostId === userId;

            if (!isHost && !member?.canAddQueue) return;

            // Ensure track exists in DB
            let dbTrack = await prisma.track.findUnique({ where: { pipedId: track.pipedId } });
            if (!dbTrack) {
                dbTrack = await prisma.track.create({
                    data: {
                        pipedId: track.pipedId,
                        title: track.title,
                        artist: track.artist || track.uploaderName || 'Unknown',
                        duration: track.duration || 0,
                        thumbnailUrl: track.thumbnail
                    }
                });
            }

            // Get current max order
            const lastItem = await prisma.roomQueue.findFirst({
                where: { roomId: room.id },
                orderBy: { order: 'desc' }
            });
            const order = lastItem ? lastItem.order + 1 : 0;

            await prisma.roomQueue.create({
                data: {
                    roomId: room.id,
                    trackId: dbTrack.id,
                    order
                }
            });

            broadcastQueue(roomCode, room.id);
            checkQueueHealth(roomCode, room.id);
        });

        socket.on('queue_remove', async ({ roomCode, queueId }) => {
            try {
                const room = await prisma.room.findUnique({
                    where: { code: roomCode },
                    include: { members: true }
                });

                if (!room) return;

                // Check if user is host or has permission
                const userId = socket.data.userId;
                const member = room.members.find(m => m.userId === userId);
                const isHost = room.hostId === userId;

                if (!isHost && !member?.canManageQueue) {
                    return;
                }

                await prisma.roomQueue.delete({
                    where: { id: queueId }
                });

                const updatedQueue = await getRoomQueue(room.id);
                io.to(roomCode).emit('queue_update', updatedQueue);

            } catch (error) {
                console.error('Error removing from queue:', error);
            }
        });

        socket.on('update_permissions', async ({ roomCode, memberId, permissions }) => {
            console.log(`[DEBUG] update_permissions: Room=${roomCode}, MemberID=${memberId}, Permissions=`, permissions);
            try {
                const { userId } = socket.data;
                const room = await prisma.room.findUnique({
                    where: { code: roomCode }
                });

                if (!room || room.hostId !== userId) return; // Only host can update permissions

                // Find the member first (handle both Member ID and User ID)
                let targetMember = await prisma.roomMember.findUnique({
                    where: { id: memberId }
                });

                if (!targetMember) {
                    // Try finding by User ID in this room
                    targetMember = await prisma.roomMember.findFirst({
                        where: { roomId: room.id, userId: memberId }
                    });
                }

                if (!targetMember) {
                    console.error(`Member not found for update: ${memberId}`);
                    return;
                }

                // Update member permissions
                try {
                    const updatedMember = await prisma.roomMember.update({
                        where: { id: targetMember.id },
                        data: {
                            canAddQueue: permissions.canAddQueue,
                            canManageQueue: permissions.canManageQueue,
                            canControlPlayback: permissions.canControlPlayback
                        },
                        include: { user: true }
                    });

                    // Broadcast update (send back the ID that was used to find it, or just the Member ID?)
                    // We should send back the Member ID (updatedMember.id) so clients update the correct record.
                    // But if client uses User ID as key, they might need that.
                    // However, client receives `members_update` with Member ID.
                    // So client SHOULD have Member ID.

                    io.to(roomCode).emit('permissions_update', {
                        memberId: updatedMember.id, // Send the canonical Member ID
                        permissions: {
                            canAddQueue: updatedMember.canAddQueue,
                            canManageQueue: updatedMember.canManageQueue,
                            canControlPlayback: updatedMember.canControlPlayback
                        }
                    });
                } catch (err) {
                    console.error(`Error updating permissions for member ${memberId}:`, err);
                }

            } catch (error) {
                console.error('Error updating permissions:', error);
            }
        });

        socket.on('disconnect', async () => {
            const { roomCode, userId } = socket.data;
            if (roomCode && userId) {
                console.log(`User ${userId} disconnected from room ${roomCode}`);

                try {
                    const room = await prisma.room.findUnique({ where: { code: roomCode } });
                    if (room) {
                        // Only remove member if the socketId matches (prevent race condition)
                        const member = await prisma.roomMember.findFirst({
                            where: { roomId: room.id, userId, socketId: socket.id }
                        });

                        if (member) {
                            await prisma.roomMember.delete({ where: { id: member.id } });
                            console.log(`Removed member ${member.id} (socket match)`);

                            // Broadcast updated members list
                            const updatedRoom = await prisma.room.findUnique({
                                where: { code: roomCode },
                                include: { members: { include: { user: true } } }
                            });

                            if (updatedRoom) {
                                const formattedMembers = updatedRoom.members.map(m => ({
                                    id: m.id,
                                    userId: m.userId,
                                    username: m.user?.username || 'Unknown',
                                    email: m.user?.email || '',
                                    role: m.userId === room.hostId ? 'HOST' : 'MEMBER',
                                    canAddQueue: m.canAddQueue,
                                    canManageQueue: m.canManageQueue,
                                    canControlPlayback: m.canControlPlayback
                                }));

                                console.log('[DEBUG] Sending members_update:', JSON.stringify(formattedMembers, null, 2));
                                io.to(roomCode).emit('members_update', formattedMembers);
                            }
                        } else {
                            console.log(`[Disconnect] Member for user ${userId} not removed (socket mismatch or already gone)`);
                        }
                    }
                } catch (error) {
                    console.error('Error handling disconnect:', error);
                }
            }
        });
    });
};
