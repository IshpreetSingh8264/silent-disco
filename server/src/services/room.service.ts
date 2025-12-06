import { PrismaClient, Room, RoomMember, RoomRole, RoomVisibility, RoomStatus, RoomQueue } from '@prisma/client';
import { redis } from './redis';
import { nanoid } from 'nanoid';
import YTMusic from 'ytmusic-api';

const ytmusic = new YTMusic();
ytmusic.initialize();

export class RoomService {
    constructor(private prisma: PrismaClient) { }

    async createRoom(userId: string, data: { name: string; visibility?: RoomVisibility; settings?: any }) {
        const code = nanoid(6).toUpperCase();

        const room = await this.prisma.room.create({
            data: {
                name: data.name,
                code,
                hostId: userId,
                visibility: data.visibility || RoomVisibility.PUBLIC,
                settings: data.settings || {},
                members: {
                    create: {
                        userId,
                        role: RoomRole.HOST
                    }
                }
            },
            include: {
                host: { select: { id: true, username: true, email: true } },
                members: true
            }
        });

        // Initialize Redis state if needed
        await redis.set(`room:${room.id}:state`, JSON.stringify({
            isPlaying: false,
            position: 0,
            updatedAt: Date.now()
        }));

        return room;
    }

    async getRoom(code: string) {
        return this.prisma.room.findUnique({
            where: { code },
            include: {
                host: { select: { id: true, username: true, email: true } },
                members: {
                    include: {
                        user: { select: { id: true, username: true, email: true } }
                    }
                },
                queue: {
                    include: { track: true },
                    orderBy: { order: 'asc' }
                }
            }
        });
    }

    async joinRoom(roomId: string, userId: string) {
        const room = await this.prisma.room.findUnique({ where: { id: roomId } });
        if (!room) throw new Error('Room not found');

        if (room.status === RoomStatus.ENDED) throw new Error('Room has ended');

        // Check if already a member
        const existingMember = await this.prisma.roomMember.findFirst({
            where: { roomId, userId }
        });

        if (existingMember) {
            if (existingMember.isBanned) throw new Error('You are banned from this room');
            return existingMember;
        }

        // Check max members
        const count = await this.prisma.roomMember.count({ where: { roomId } });
        if (count >= room.maxMembers) throw new Error('Room is full');

        return this.prisma.roomMember.create({
            data: {
                roomId,
                userId,
                role: RoomRole.MEMBER
            },
            include: {
                user: { select: { id: true, username: true, email: true } }
            }
        });
    }

    async leaveRoom(roomId: string, userId: string) {
        // We might not want to delete the member record to keep history/bans, 
        // but for now let's just remove them or mark them inactive?
        // The spec says "guests can leave and rejoin".
        // Let's delete for now to keep it simple, unless they are host.

        const member = await this.prisma.roomMember.findFirst({
            where: { roomId, userId }
        });

        if (!member) return;

        if (member.role === RoomRole.HOST) {
            // If host leaves, we might need to assign new host or end room.
            // For v1, let's just keep the room but maybe pause it?
            // Or do nothing and wait for disconnect logic.
            // If they explicitly "leave" (not just disconnect), maybe end room?
            // Let's just remove them for now.
        }

        await this.prisma.roomMember.delete({
            where: { id: member.id }
        });
    }

    async getPublicRooms(limit = 20, cursor?: string) {
        return this.prisma.room.findMany({
            where: {
                visibility: RoomVisibility.PUBLIC,
                status: RoomStatus.ACTIVE
            },
            take: limit,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { updatedAt: 'desc' },
            include: {
                host: { select: { username: true } },
                _count: { select: { members: true } }
            }
        });
    }

    async addToQueue(roomId: string, userId: string, track: any) {
        // Ensure track exists
        let dbTrack = await this.prisma.track.findUnique({ where: { pipedId: track.pipedId } });
        if (!dbTrack) {
            dbTrack = await this.prisma.track.create({
                data: {
                    pipedId: track.pipedId,
                    title: track.title,
                    artist: track.artist || track.uploaderName || 'Unknown',
                    duration: track.duration || 0,
                    thumbnailUrl: track.thumbnail
                }
            });
        }

        const lastItem = await this.prisma.roomQueue.findFirst({
            where: { roomId },
            orderBy: { order: 'desc' }
        });
        const order = lastItem ? lastItem.order + 1 : 0;

        const queueItem = await this.prisma.roomQueue.create({
            data: {
                roomId,
                trackId: dbTrack.id,
                order,
                addedBy: userId
            },
            include: { track: true }
        });

        return queueItem;
    }

    async removeFromQueue(roomId: string, queueId: string) {
        try {
            await this.prisma.roomQueue.delete({ where: { id: queueId } });
        } catch (e) {
            // Ignore if already deleted
        }
    }

    async voteSkip(roomId: string, userId: string) {
        // Implement vote skip logic using Redis for ephemeral votes
        const room = await this.prisma.room.findUnique({ where: { id: roomId } });
        if (!room || !room.isPlaying) return false;

        const voteKey = `room:${roomId}:votes`;
        await redis.sadd(voteKey, userId);

        const votes = await redis.scard(voteKey);
        const memberCount = await this.prisma.roomMember.count({ where: { roomId } });

        // Threshold: 50%
        const required = Math.ceil(memberCount * 0.5);

        return { votes, required, passed: votes >= required };
    }

    async checkQueueHealth(roomId: string) {
        const unplayedCount = await this.prisma.roomQueue.count({
            where: { roomId, isPlayed: false }
        });

        if (unplayedCount < 3) {
            await this.addRecommendations(roomId);
            return true; // Queue updated
        }
        return false;
    }

    private async addRecommendations(roomId: string) {
        const lastItem = await this.prisma.roomQueue.findFirst({
            where: { roomId },
            orderBy: { order: 'desc' },
            include: { track: true }
        });

        let seedTrackId = lastItem?.track?.pipedId;
        if (!seedTrackId) {
            const room = await this.prisma.room.findUnique({ where: { id: roomId } });
            seedTrackId = room?.currentTrackId || undefined;
        }

        if (!seedTrackId) return;

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

                const exists = await this.prisma.roomQueue.findFirst({
                    where: {
                        roomId,
                        track: { pipedId: rec.videoId },
                        isPlayed: false
                    }
                });

                if (!exists) {
                    await this.addToQueue(roomId, 'SYSTEM', {
                        pipedId: rec.videoId,
                        title: rec.name || rec.title,
                        artist: rec.artist?.name || rec.uploaderName || 'Unknown',
                        duration: rec.duration || 0,
                        thumbnail: rec.thumbnails?.[rec.thumbnails.length - 1]?.url || rec.thumbnail
                    });
                    addedCount++;
                }
            }
        } catch (err) {
            console.error('Smart Queue Error:', err);
        }
    }
}
