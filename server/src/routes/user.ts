import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const userRoutes: FastifyPluginAsync = async (server) => {
    // Get Listening History
    server.get('/history', { preValidation: [server.authenticate] }, async (request, reply) => {
        const history = await server.prisma.listeningHistory.findMany({
            where: { userId: request.user.userId },
            include: { track: true },
            orderBy: { playedAt: 'desc' },
            take: 50 // Limit to last 50 tracks
        });
        return history.map((h: any) => h.track);
    });

    // Add to Listening History
    server.post('/history', { preValidation: [server.authenticate] }, async (request, reply) => {
        const schema = z.object({
            track: z.object({
                pipedId: z.string(),
                title: z.string(),
                artist: z.string().optional(),
                uploaderName: z.string().optional(),
                thumbnailUrl: z.string().optional(),
                duration: z.number()
            }),
            context: z.string().optional()
        });
        const { track: trackData, context } = schema.parse(request.body);

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
            // @ts-ignore
            track = await server.prisma.track.create({ data: dbTrackData });
        }

        // Add to history
        await server.prisma.listeningHistory.create({
            data: {
                userId: request.user.userId,
                trackId: track.id,
                context
            }
        });

        // Update UserTrackStats (Upsert)
        await server.prisma.userTrackStats.upsert({
            where: {
                userId_trackId: {
                    userId: request.user.userId,
                    trackId: track.id
                }
            },
            update: {
                playCount: { increment: 1 },
                lastPlayedAt: new Date()
            },
            create: {
                userId: request.user.userId,
                trackId: track.id,
                playCount: 1,
                lastPlayedAt: new Date()
            }
        });

        // Update Global Track Stats
        await server.prisma.track.update({
            where: { id: track.id },
            data: { globalPlayCount: { increment: 1 } }
        });

        return { success: true };
    });

    // Record User Signal (Skip, Like, Dwell, etc.)
    server.post('/signals', { preValidation: [server.authenticate] }, async (request, reply) => {
        const schema = z.object({
            trackId: z.string(),
            type: z.string(),
            value: z.number().optional(),
            metadata: z.any().optional()
        });

        try {
            const { trackId, type, value, metadata } = schema.parse(request.body);

            // Try to find by pipedId first (common case from frontend)
            let track = await server.prisma.track.findUnique({ where: { pipedId: trackId } });

            // If not found, try by internal ID
            if (!track) {
                track = await server.prisma.track.findUnique({ where: { id: trackId } });
            }

            if (!track) {
                // If still not found, we can't record the signal effectively linked to a track
                // But we shouldn't crash.
                return reply.status(404).send({ error: 'Track not found' });
            }

            await server.prisma.userSignal.create({
                data: {
                    userId: request.user.userId,
                    trackId: track.id,
                    type,
                    value,
                    metadata: metadata || {}
                }
            });

            // If signal is SKIP, update stats
            if (type === 'SKIP') {
                await server.prisma.userTrackStats.upsert({
                    where: {
                        userId_trackId: {
                            userId: request.user.userId,
                            trackId: track.id
                        }
                    },
                    update: {
                        skipCount: { increment: 1 }
                    },
                    create: {
                        userId: request.user.userId,
                        trackId: track.id,
                        skipCount: 1
                    }
                });
            }

            return { success: true };
        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to record signal' });
        }
    });
};

export default userRoutes;
