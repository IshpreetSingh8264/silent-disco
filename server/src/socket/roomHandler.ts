import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
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
        const queueItems = await prisma.roomQueue.findMany({
            where: { roomId },
            include: { track: true },
            orderBy: { order: 'asc' }
        });

        const mappedQueue = queueItems.map(item => ({
            ...item.track,
            url: `/api/music/streams/${item.track.pipedId}`,
            thumbnail: item.track.thumbnailUrl,
            uploaderName: item.track.artist,
            queueId: item.id,
            isPlayed: (item as any).isPlayed
        }));

        io.to(roomCode).emit('queue_update', mappedQueue);
    };

    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on('join_room', async ({ roomCode, userId }) => {
            try {
                const room = await prisma.room.findUnique({ where: { code: roomCode } });
                if (!room) return;

                socket.join(roomCode);
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

                // Broadcast updated member list to ALL in room
                io.to(roomCode).emit('members_update', members.map(m => m.user));

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

        socket.on('play', async ({ roomCode, track, position }) => {
            socket.to(roomCode).emit('play', { track, position });

            // Update DB
            const room = await prisma.room.findUnique({ where: { code: roomCode } });
            if (room) {
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
                // Also mark any previous items as played?
                // Let's find the queue item for this track
                // If there are multiple, we should pick the first unplayed one?
                // Or if we have a queueId passed in 'play' event, that would be better.
                // Assuming track object has queueId if it came from queue.
                if ((track as any).queueId) {
                    await prisma.roomQueue.update({
                        where: { id: (track as any).queueId },
                        data: { isPlayed: true }
                    });
                } else {
                    // Try to find by trackId if no queueId (e.g. played from search)
                    // But be careful not to mark future instances?
                    // Let's just leave it if no queueId.
                }

                // Trigger Smart Queue Check
                checkQueueHealth(roomCode, room.id);
                broadcastQueue(roomCode, room.id);
            }
        });

        socket.on('pause', async ({ roomCode, position }) => {
            socket.to(roomCode).emit('pause', { position });
            const room = await prisma.room.findUnique({ where: { code: roomCode } });
            if (room) {
                await prisma.room.update({
                    where: { id: room.id },
                    data: { isPlaying: false, position }
                });
            }
        });

        socket.on('seek', async ({ roomCode, position }) => {
            socket.to(roomCode).emit('seek', { position });
            const room = await prisma.room.findUnique({ where: { code: roomCode } });
            if (room) {
                await prisma.room.update({
                    where: { id: room.id },
                    data: { position }
                });
            }
        });

        socket.on('queue_add', async ({ roomCode, track }) => {
            const room = await prisma.room.findUnique({ where: { code: roomCode } });
            if (!room) return;

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
            const room = await prisma.room.findUnique({ where: { code: roomCode } });
            if (!room) return;

            try {
                await prisma.roomQueue.delete({ where: { id: queueId } });
            } catch (e) {
                // Item might already be deleted
            }

            broadcastQueue(roomCode, room.id);
            checkQueueHealth(roomCode, room.id);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });
};
