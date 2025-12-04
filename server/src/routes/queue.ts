import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ytmusic } from '../services/ytmusic';

const queueRoutes: FastifyPluginAsync = async (server) => {
    // GET /api/queue - Fetch user's queue
    server.get('/', {
        preValidation: [server.authenticate]
    }, async (request, reply) => {
        const userId = request.user.userId;
        const queue = await server.prisma.userQueue.findMany({
            where: { userId },
            orderBy: { position: 'asc' },
            include: { track: { include: { artistRel: true } } }
        });
        return queue.map(q => ({
            ...q.track,
            queueId: q.id, // Use UserQueue ID as unique identifier in frontend
            isManual: q.source === 'MANUAL',
            url: `/api/music/streams/${q.track.pipedId}`, // Generate stream URL
            artistId: q.track.artistId, // Ensure artistId is passed
            duration: q.track.duration || 0 // Explicitly pass duration
        }));
    });

    // POST /api/queue - Add track to queue
    server.post('/', {
        preValidation: [server.authenticate]
    }, async (request, reply) => {
        const schema = z.object({
            track: z.object({
                id: z.string().optional(),
                pipedId: z.string(),
                title: z.string(),
                thumbnail: z.string().optional(),
                uploaderName: z.string(),
                duration: z.number(),
                url: z.string()
            }),
            source: z.enum(['MANUAL', 'SYSTEM', 'AI']).default('MANUAL')
        });

        const { track, source } = schema.parse(request.body);
        const userId = request.user.userId;

        // ...

        // Ensure track exists in DB
        let dbTrack = await server.prisma.track.findUnique({ where: { pipedId: track.pipedId } });

        // If track doesn't exist OR has 0 duration, try to fetch details
        if (!dbTrack || dbTrack.duration === 0) {
            let duration = track.duration;

            // If incoming duration is 0/missing, fetch from YTMusic
            if (!duration) {
                try {
                    const songDetails: any = await ytmusic.getSong(track.pipedId);
                    if (songDetails && songDetails.duration) {
                        duration = songDetails.duration;
                    }
                } catch (e) {
                    server.log.warn(`Failed to fetch duration for ${track.pipedId}: ${e}`);
                }
            }

            if (!dbTrack) {
                dbTrack = await server.prisma.track.create({
                    data: {
                        pipedId: track.pipedId,
                        title: track.title,
                        artist: track.uploaderName,
                        thumbnailUrl: track.thumbnail,
                        duration: duration || 0
                    }
                });
            } else if (dbTrack.duration === 0 && duration > 0) {
                // Update existing track with duration
                dbTrack = await server.prisma.track.update({
                    where: { id: dbTrack.id },
                    data: { duration }
                });
            }
        }

        // Get last position
        const lastItem = await server.prisma.userQueue.findFirst({
            where: { userId },
            orderBy: { position: 'desc' }
        });
        const position = (lastItem?.position || 0) + 1000; // Spacing for reordering

        const queueItem = await server.prisma.userQueue.create({
            data: {
                userId,
                trackId: dbTrack.id,
                position,
                source
            },
            include: { track: true }
        });

        return {
            ...queueItem.track,
            queueId: queueItem.id,
            isManual: source === 'MANUAL'
        };
    });

    // DELETE /api/queue/:id - Remove from queue
    server.delete('/:id', {
        preValidation: [server.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = request.user.userId;

        await server.prisma.userQueue.deleteMany({
            where: { id, userId } // Ensure ownership
        });

        return { success: true };
    });

    // PUT /api/queue/reorder - Reorder tracks
    server.put('/reorder', {
        preValidation: [server.authenticate]
    }, async (request, reply) => {
        const schema = z.object({
            queueIds: z.array(z.string()) // List of queueIds in new order
        });
        const { queueIds } = schema.parse(request.body);
        const userId = request.user.userId;

        // We can use a transaction to update positions
        // Simple strategy: update all positions based on index * 1000
        // Optimization: only update changed items? For now, simple is robust.

        // Actually, updating all might be heavy if queue is long.
        // But user queues are usually short (< 100).

        const updates = queueIds.map((id, index) =>
            server.prisma.userQueue.updateMany({
                where: { id, userId },
                data: { position: (index + 1) * 1000 }
            })
        );

        await server.prisma.$transaction(updates);

        return { success: true };
    });

    // DELETE /api/queue/clear
    server.delete('/clear', {
        preValidation: [server.authenticate]
    }, async (request, reply) => {
        const userId = request.user.userId;
        await server.prisma.userQueue.deleteMany({ where: { userId } });
        return { success: true };
    });
};

export default queueRoutes;
