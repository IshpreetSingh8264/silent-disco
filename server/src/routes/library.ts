import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ytmusic } from '../services/ytmusic';

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: any;
    }
    interface FastifyRequest {
        user: {
            userId: string;
            username: string;
            email: string;
        };
    }
}

const libraryRoutes: FastifyPluginAsync = async (server) => {
    // Get User's Playlists
    server.get('/playlists', { preValidation: [server.authenticate] }, async (request, reply) => {
        const playlists = await server.prisma.playlist.findMany({
            where: { userId: request.user.userId },
            include: { _count: { select: { tracks: true } } }
        });
        return playlists;
    });

    // Create Playlist
    server.post('/playlists', { preValidation: [server.authenticate] }, async (request, reply) => {
        const schema = z.object({ name: z.string().min(1) });
        const { name } = schema.parse(request.body);

        const playlist = await server.prisma.playlist.create({
            data: {
                name,
                userId: request.user.userId
            }
        });
        return playlist;
    });

    // Get Playlist Details
    server.get('/playlists/:id', { preValidation: [server.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const playlist = await server.prisma.playlist.findUnique({
            where: { id },
            include: {
                tracks: {
                    include: { track: { include: { artistRel: true } } },
                    orderBy: { order: 'asc' }
                }
            }
        });
        if (!playlist) return reply.status(404).send({ error: 'Playlist not found' });
        return playlist;
    });

    // Add Track to Playlist
    server.post('/playlists/:id/tracks', { preValidation: [server.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const schema = z.object({
            track: z.object({
                pipedId: z.string(),
                title: z.string(),
                artist: z.string().optional(),
                uploaderName: z.string().optional(),
                thumbnailUrl: z.string().optional(),
                duration: z.number()
            })
        });
        const { track: trackData } = schema.parse(request.body);

        const artistName = trackData.artist || trackData.uploaderName || 'Unknown Artist';

        // Ensure track exists in DB
        let track = await server.prisma.track.findUnique({ where: { pipedId: trackData.pipedId } });

        // If track doesn't exist OR has 0 duration, try to fetch details
        if (!track || track.duration === 0) {
            let duration = trackData.duration;

            if (!duration) {
                try {
                    const songDetails: any = await ytmusic.getSong(trackData.pipedId);
                    if (songDetails && songDetails.duration) {
                        duration = songDetails.duration;
                    }
                } catch (e) {
                    server.log.warn(`Failed to fetch duration for ${trackData.pipedId}: ${e}`);
                }
            }

            if (!track) {
                track = await server.prisma.track.create({
                    data: {
                        pipedId: trackData.pipedId,
                        title: trackData.title,
                        artist: artistName,
                        thumbnailUrl: trackData.thumbnailUrl,
                        duration: duration || 0
                    }
                });
            } else if (track.duration === 0 && duration > 0) {
                track = await server.prisma.track.update({
                    where: { id: track.id },
                    data: { duration }
                });
            }
        }

        // Get current max order
        const lastTrack = await server.prisma.playlistTrack.findFirst({
            where: { playlistId: id },
            orderBy: { order: 'desc' }
        });
        const order = lastTrack ? lastTrack.order + 1 : 0;

        await server.prisma.playlistTrack.create({
            data: {
                playlistId: id,
                trackId: track.id,
                order
            }
        });

        return { success: true };
    });

    // Get Liked Songs
    server.get('/liked', { preValidation: [server.authenticate] }, async (request, reply) => {
        const likedTracks = await server.prisma.likedTrack.findMany({
            where: { userId: request.user.userId },
            include: { track: { include: { artistRel: true } } },
            orderBy: { likedAt: 'desc' }
        });
        return likedTracks.map((lt: any) => lt.track);
    });

    // Toggle Like
    server.post('/liked', { preValidation: [server.authenticate] }, async (request, reply) => {
        const schema = z.object({
            track: z.object({
                id: z.string().optional(),
                pipedId: z.string().optional(),
                title: z.string(),
                artist: z.string().optional(),
                uploaderName: z.string().optional(),
                thumbnailUrl: z.string().optional(),
                duration: z.number().optional()
            })
        });
        const { track: trackData } = schema.parse(request.body);

        const pipedId = trackData.pipedId || trackData.id;
        if (!pipedId) {
            return reply.status(400).send({ error: 'Track ID or Piped ID required' });
        }

        // Ensure track exists
        let track = await server.prisma.track.findUnique({ where: { pipedId } });

        if (!track || track.duration === 0) {
            let duration = trackData.duration || 0;

            if (!duration) {
                try {
                    const songDetails: any = await ytmusic.getSong(pipedId);
                    if (songDetails && songDetails.duration) {
                        duration = songDetails.duration;
                    }
                } catch (e) {
                    server.log.warn(`Failed to fetch duration for ${pipedId}: ${e}`);
                }
            }

            const dbTrackData = {
                pipedId,
                title: trackData.title,
                artist: trackData.artist || trackData.uploaderName || 'Unknown Artist',
                thumbnailUrl: trackData.thumbnailUrl,
                duration: duration
            };

            if (!track) {
                track = await server.prisma.track.create({ data: dbTrackData });
            } else if (track.duration === 0 && duration > 0) {
                track = await server.prisma.track.update({
                    where: { id: track.id },
                    data: { duration }
                });
            }
        }

        const existingLike = await server.prisma.likedTrack.findUnique({
            where: {
                userId_trackId: {
                    userId: request.user.userId,
                    trackId: track.id
                }
            }
        });

        if (existingLike) {
            await server.prisma.likedTrack.delete({ where: { id: existingLike.id } });
            return { liked: false };
        } else {
            await server.prisma.likedTrack.create({
                data: {
                    userId: request.user.userId,
                    trackId: track.id
                }
            });
            return { liked: true };
        }
    });

    // Delete Playlist
    server.delete('/playlists/:id', { preValidation: [server.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        // Verify ownership
        const playlist = await server.prisma.playlist.findUnique({ where: { id } });
        if (!playlist || playlist.userId !== request.user.userId) {
            return reply.status(403).send({ error: 'Not authorized' });
        }

        // Delete tracks first (cascade should handle this but explicit is safer)
        await server.prisma.playlistTrack.deleteMany({ where: { playlistId: id } });
        await server.prisma.playlist.delete({ where: { id } });

        return { success: true };
    });

    // Remove Track from Playlist
    server.delete('/playlists/:id/tracks/:trackId', { preValidation: [server.authenticate] }, async (request, reply) => {
        const { id, trackId } = request.params as { id: string; trackId: string };

        // Verify ownership
        const playlist = await server.prisma.playlist.findUnique({ where: { id } });
        if (!playlist || playlist.userId !== request.user.userId) {
            return reply.status(403).send({ error: 'Not authorized' });
        }

        await server.prisma.playlistTrack.deleteMany({
            where: {
                playlistId: id,
                trackId: trackId
            }
        });

        return { success: true };
    });
};

export default libraryRoutes;
