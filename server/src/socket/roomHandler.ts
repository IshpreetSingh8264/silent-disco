import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import YTMusic from 'ytmusic-api';
import { redis } from '../services/redis';

const ytmusic = new YTMusic();
ytmusic.initialize();

export const setupRoomHandlers = (io: Server, prisma: PrismaClient) => {

    // Helper: Format members consistently
    const formatMembers = (members: any[], hostId: string) => {
        return members.map(m => ({
            id: m.id,
            userId: m.userId,
            username: m.user?.username || 'Unknown',
            email: m.user?.email || '',
            role: m.userId === hostId ? 'HOST' : 'MEMBER',
            canAddQueue: m.canAddQueue,
            canManageQueue: m.canManageQueue,
            canControlPlayback: m.canControlPlayback
        }));
    };

    // Helper: Broadcast members to room
    const broadcastMembers = async (roomCode: string, roomId: string, hostId: string) => {
        const members = await prisma.roomMember.findMany({
            where: { roomId },
            include: { user: { select: { id: true, username: true, email: true } } }
        });
        const formatted = formatMembers(members, hostId);
        io.to(roomCode).emit('members_update', formatted);
    };

    // Helper: Calculate current position based on stored position + elapsed time
    const calculateCurrentPosition = (room: any): number => {
        if (!room.isPlaying) return room.position;

        const elapsed = (Date.now() - new Date(room.updatedAt).getTime()) / 1000;
        return room.position + elapsed;
    };

    // Helper: Get room state with calculated position
    const getRoomState = async (roomId: string) => {
        const room = await prisma.room.findUnique({
            where: { id: roomId }
        });
        if (!room) return null;

        const track = room.currentTrackId
            ? await prisma.track.findUnique({ where: { pipedId: room.currentTrackId } })
            : null;

        const queue = await getRoomQueue(roomId);
        const currentPosition = calculateCurrentPosition(room);

        return {
            isPlaying: room.isPlaying,
            position: currentPosition,
            track: track ? {
                ...track,
                url: `/api/music/streams/${track.pipedId}`,
                thumbnail: track.thumbnailUrl,
                uploaderName: track.artist
            } : null,
            queue,
            timestamp: Date.now()
        };
    };

    const checkQueueHealth = async (roomCode: string, roomId: string) => {
        const unplayedCount = await prisma.roomQueue.count({
            where: { roomId, isPlayed: false } as any
        });

        if (unplayedCount < 3) {
            const lastItem = await prisma.roomQueue.findFirst({
                where: { roomId },
                orderBy: { order: 'desc' },
                include: { track: true }
            });

            let seedTrackId = lastItem?.track?.pipedId;

            if (!seedTrackId) {
                const room = await prisma.room.findUnique({ where: { id: roomId } });
                seedTrackId = room?.currentTrackId || undefined;
            }

            if (seedTrackId) {
                try {
                    const cacheKey = `recommendations:${seedTrackId}`;
                    let recommendations: any[] = [];
                    const cached = await redis.get(cacheKey);

                    if (cached) {
                        recommendations = JSON.parse(cached);
                    } else {
                        const searchResults = await ytmusic.search(lastItem?.track?.title || 'trending music');
                        recommendations = searchResults.filter((item: any) => item.videoId && item.videoId !== seedTrackId).slice(0, 5);
                        await redis.set(cacheKey, JSON.stringify(recommendations), 3600);
                    }

                    let addedCount = 0;
                    for (const rec of recommendations) {
                        if (addedCount >= 3) break;

                        const exists = await prisma.roomQueue.findFirst({
                            where: {
                                roomId,
                                track: { pipedId: rec.videoId },
                                isPlayed: false
                            } as any
                        });

                        if (!exists) {
                            let dbTrack = await prisma.track.findUnique({ where: { pipedId: rec.videoId } });
                            if (!dbTrack) {
                                dbTrack = await prisma.track.create({
                                    data: {
                                        pipedId: rec.videoId,
                                        title: rec.name || rec.title,
                                        artist: rec.artist?.name || rec.uploaderName || 'Unknown',
                                        duration: rec.duration || 0,
                                        thumbnailUrl: rec.thumbnails?.[rec.thumbnails.length - 1]?.url || rec.thumbnail
                                    }
                                });
                            }

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
            id: item.track.id,
            pipedId: item.track.pipedId,
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
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    socket.emit('auth_error', 'No authentication token provided.');
                    return;
                }

                let userId: string;
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
                    userId = decoded.userId;
                } catch (err) {
                    socket.emit('auth_error', 'Invalid authentication token.');
                    return;
                }

                socket.data.roomCode = roomCode;
                socket.data.userId = userId;

                const room = await prisma.room.findUnique({ where: { code: roomCode } });
                if (!room) {
                    socket.emit('room_error', 'Room not found.');
                    return;
                }

                await socket.join(roomCode);

                // Upsert member
                const existingMember = await prisma.roomMember.findFirst({
                    where: { roomId: room.id, userId }
                });

                if (existingMember) {
                    await prisma.roomMember.update({
                        where: { id: existingMember.id },
                        data: { socketId: socket.id }
                    });
                } else {
                    await prisma.roomMember.create({
                        data: {
                            userId,
                            roomId: room.id,
                            socketId: socket.id,
                            canAddQueue: true,
                            canManageQueue: room.hostId === userId,
                            canControlPlayback: room.hostId === userId
                        }
                    });
                }

                await broadcastMembers(roomCode, room.id, room.hostId);

                const isHost = room.hostId === userId;
                socket.emit('is_host', isHost);

                // Send current room state with calculated position
                const roomState = await getRoomState(room.id);
                if (roomState) {
                    socket.emit('sync_state', roomState);
                }

            } catch (error) {
                console.error('Error joining room:', error);
            }
        });

        socket.on('leave_room', async () => {
            const { roomCode, userId } = socket.data;
            if (!roomCode || !userId) return;

            try {
                const room = await prisma.room.findUnique({ where: { code: roomCode } });
                if (!room) return;

                socket.leave(roomCode);

                await prisma.roomMember.deleteMany({
                    where: { roomId: room.id, userId }
                });

                await broadcastMembers(roomCode, room.id, room.hostId);
                socket.data.roomCode = null;
                socket.data.userId = null;

            } catch (error) {
                console.error('Error leaving room:', error);
            }
        });

        socket.on('request_sync', async ({ roomCode }) => {
            try {
                const room = await prisma.room.findUnique({ where: { code: roomCode } });
                if (!room) return;

                const roomState = await getRoomState(room.id);
                if (roomState) {
                    socket.emit('sync_state', roomState);
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
                return;
            }

            // Store track in DB
            let dbTrack = await prisma.track.findUnique({ where: { pipedId: track.pipedId } });
            if (!dbTrack) {
                dbTrack = await prisma.track.create({
                    data: {
                        pipedId: track.pipedId,
                        title: track.title,
                        artist: track.artist || track.uploaderName || 'Unknown',
                        duration: track.duration || 0,
                        thumbnailUrl: track.thumbnail || track.thumbnailUrl
                    }
                });
            }

            // Update room state - position and timestamp for future calculations
            await prisma.room.update({
                where: { id: room.id },
                data: {
                    isPlaying: true,
                    currentTrackId: track.pipedId,
                    position: position ?? 0,
                    updatedAt: new Date()
                }
            });

            // Mark queue item as played
            if (track.queueId) {
                await prisma.roomQueue.update({
                    where: { id: track.queueId },
                    data: { isPlayed: true }
                }).catch(() => { });
            }

            // Broadcast to ALL in room including sender
            const trackWithUrl = {
                ...track,
                url: `/api/music/streams/${track.pipedId}`,
                thumbnail: track.thumbnail || track.thumbnailUrl,
                uploaderName: track.artist || track.uploaderName
            };
            io.to(roomCode).emit('play', { track: trackWithUrl, position: position ?? 0, timestamp: Date.now() });

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

            // Store the exact position when paused
            await prisma.room.update({
                where: { id: room.id },
                data: {
                    isPlaying: false,
                    position: position ?? 0,
                    updatedAt: new Date()
                }
            });

            io.to(roomCode).emit('pause', { position: position ?? 0, timestamp: Date.now() });
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

            // Store new position with current timestamp
            await prisma.room.update({
                where: { id: room.id },
                data: {
                    position,
                    updatedAt: new Date()
                }
            });

            io.to(roomCode).emit('seek', { position, timestamp: Date.now() });
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

            let dbTrack = await prisma.track.findUnique({ where: { pipedId: track.pipedId } });
            if (!dbTrack) {
                dbTrack = await prisma.track.create({
                    data: {
                        pipedId: track.pipedId,
                        title: track.title,
                        artist: track.artist || track.uploaderName || 'Unknown',
                        duration: track.duration || 0,
                        thumbnailUrl: track.thumbnail || track.thumbnailUrl
                    }
                });
            }

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

                const userId = socket.data.userId;
                const member = room.members.find(m => m.userId === userId);
                const isHost = room.hostId === userId;

                if (!isHost && !member?.canManageQueue) {
                    return;
                }

                await prisma.roomQueue.delete({
                    where: { id: queueId }
                });

                broadcastQueue(roomCode, room.id);

            } catch (error) {
                console.error('Error removing from queue:', error);
            }
        });

        socket.on('update_permissions', async ({ roomCode, memberId, permissions }) => {
            try {
                const { userId } = socket.data;
                const room = await prisma.room.findUnique({
                    where: { code: roomCode }
                });

                if (!room || room.hostId !== userId) {
                    return;
                }

                let targetMember = await prisma.roomMember.findUnique({
                    where: { id: memberId }
                });

                if (!targetMember) {
                    targetMember = await prisma.roomMember.findFirst({
                        where: { roomId: room.id, userId: memberId }
                    });
                }

                if (!targetMember) {
                    return;
                }

                const updateData: any = {};
                if (permissions.canAddQueue !== undefined) updateData.canAddQueue = permissions.canAddQueue;
                if (permissions.canManageQueue !== undefined) updateData.canManageQueue = permissions.canManageQueue;
                if (permissions.canControlPlayback !== undefined) updateData.canControlPlayback = permissions.canControlPlayback;

                await prisma.roomMember.update({
                    where: { id: targetMember.id },
                    data: updateData
                });

                await broadcastMembers(roomCode, room.id, room.hostId);

            } catch (error) {
                console.error('Error updating permissions:', error);
            }
        });

        socket.on('disconnect', async () => {
            const { roomCode, userId } = socket.data;
            if (!roomCode || !userId) return;

            try {
                const room = await prisma.room.findUnique({ where: { code: roomCode } });
                if (!room) return;

                const member = await prisma.roomMember.findFirst({
                    where: { roomId: room.id, userId, socketId: socket.id }
                });

                if (member) {
                    await prisma.roomMember.delete({ where: { id: member.id } });
                    await broadcastMembers(roomCode, room.id, room.hostId);
                }
            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        });
    });
};
