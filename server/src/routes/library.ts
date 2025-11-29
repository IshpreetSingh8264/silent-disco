import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

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
                    include: { track: true },
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
                artist: z.string(),
                thumbnailUrl: z.string().optional(),
                duration: z.number()
            })
        });
        const { track: trackData } = schema.parse(request.body);

        // Ensure track exists in DB
        let track = await server.prisma.track.findUnique({ where: { pipedId: trackData.pipedId } });
        if (!track) {
            track = await server.prisma.track.create({ data: trackData });
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
            include: { track: true },
            orderBy: { likedAt: 'desc' }
        });
        return likedTracks.map((lt: any) => lt.track);
    });

    // Toggle Like
    server.post('/liked', { preValidation: [server.authenticate] }, async (request, reply) => {
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

        // Map uploaderName to artist if artist is missing
        const dbTrackData = {
            ...trackData,
            artist: trackData.artist || trackData.uploaderName || 'Unknown Artist'
        };
        // Remove uploaderName from dbTrackData as it's not in Prisma model
        delete (dbTrackData as any).uploaderName;

        // Ensure track exists
        let track = await server.prisma.track.findUnique({ where: { pipedId: trackData.pipedId } });
        if (!track) {
            // @ts-ignore - dbTrackData has correct shape but TS complains about uploaderName deletion
            track = await server.prisma.track.create({ data: dbTrackData });
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
