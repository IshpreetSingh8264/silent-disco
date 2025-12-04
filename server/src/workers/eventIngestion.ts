import { PrismaClient } from '@prisma/client';
import { redis } from '../services/redis';
import { AnalyticsEvent } from '../services/eventBuffer';
import { ytmusic } from '../services/ytmusic';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;
const INTERVAL_MS = 5000;

export const startWorker = () => {
    console.log('Starting Event Ingestion Worker...');

    setInterval(async () => {
        try {
            // Redis 6.2+ supports count in LPOP. If older, use loop or transaction.
            // Assuming Redis 6.2+ for production.
            // ioredis lpop returns string | null if count not specified, or string[] if count specified?
            // Actually ioredis types might not fully support count overload depending on version.
            // Let's use a loop for safety or check ioredis version.
            // Or use pipeline.

            const pipeline = redis.pipeline();
            for (let i = 0; i < BATCH_SIZE; i++) {
                pipeline.rpop('events:buffer'); // FIFO (LPUSH in buffer)
            }
            const results = await pipeline.exec();

            if (!results) return;

            const events: AnalyticsEvent[] = [];
            for (const [err, result] of results) {
                if (!err && result) {
                    try {
                        events.push(JSON.parse(result as string));
                    } catch (e) {
                        console.error('Failed to parse event:', result);
                    }
                }
            }

            if (events.length === 0) return;

            console.log(`Processing ${events.length} events...`);

            // Group by type
            const historyEvents = events.filter(e => e.type === 'PLAYED');
            const signalEvents = events.filter(e => e.type !== 'PLAYED' && e.type !== 'CONTEXT');
            const contextEvents = events.filter(e => e.type === 'CONTEXT');

            // Bulk Insert

            // 1. Ensure Tracks Exist
            const uniqueTracks = new Map<string, any>();
            events.forEach(e => {
                if (e.trackId && e.trackDetails) {
                    uniqueTracks.set(e.trackId, e.trackDetails);
                }
            });

            // ...

            if (uniqueTracks.size > 0) {
                // We need to map the map to array
                const tracksToCreate = await Promise.all(Array.from(uniqueTracks.entries()).map(async ([id, details]) => {
                    let duration = details.duration || 0;

                    if (!duration) {
                        try {
                            const songDetails: any = await ytmusic.getSong(id);
                            if (songDetails && songDetails.duration) {
                                duration = songDetails.duration;
                            }
                        } catch (e) {
                            console.warn(`[Ingestion] Failed to fetch duration for ${id}: ${e}`);
                        }
                    }

                    return {
                        pipedId: id,
                        title: details.title,
                        artist: details.artist,
                        thumbnailUrl: details.thumbnailUrl,
                        duration: duration
                    };
                }));

                // Use upsert logic manually or createMany with skipDuplicates
                // Since we want to update duration if it was 0, createMany(skipDuplicates) won't update.
                // We should iterate and upsert.

                for (const track of tracksToCreate) {
                    const existing = await prisma.track.findUnique({ where: { pipedId: track.pipedId } });
                    if (!existing) {
                        await prisma.track.create({ data: track });
                    } else if (existing.duration === 0 && track.duration > 0) {
                        await prisma.track.update({
                            where: { id: existing.id },
                            data: { duration: track.duration }
                        });
                    }
                }
            }

            // 2. Resolve Piped IDs to Internal UUIDs
            const trackIdsToResolve = new Set<string>();
            events.forEach(e => {
                if (e.trackId) trackIdsToResolve.add(e.trackId);
            });

            const resolvedTracks = await prisma.track.findMany({
                where: {
                    pipedId: { in: Array.from(trackIdsToResolve) }
                },
                select: { id: true, pipedId: true }
            });

            const trackIdMap = new Map<string, string>();
            resolvedTracks.forEach(t => {
                trackIdMap.set(t.pipedId, t.id);
            });

            // Helper to get internal ID (fallback to original if it looks like UUID, though risky)
            const getInternalId = (externalId: string) => trackIdMap.get(externalId);

            if (historyEvents.length > 0) {
                const validHistory = historyEvents
                    .filter(e => e.trackId && getInternalId(e.trackId))
                    .map(e => ({
                        userId: e.userId,
                        trackId: getInternalId(e.trackId!)!,
                        playedAt: new Date(e.timestamp),
                        durationPlayed: e.value,
                        context: e.metadata?.context
                    }));

                if (validHistory.length > 0) {
                    await prisma.listeningHistory.createMany({
                        data: validHistory
                    });
                }
            }

            if (signalEvents.length > 0) {
                const validSignals = signalEvents
                    .filter(e => e.trackId && getInternalId(e.trackId))
                    .map(e => ({
                        userId: e.userId,
                        trackId: getInternalId(e.trackId!)!,
                        type: e.type as any, // Cast to SignalType
                        value: e.value,
                        metadata: e.metadata,
                        createdAt: new Date(e.timestamp)
                    }));

                if (validSignals.length > 0) {
                    await prisma.userSignal.createMany({
                        data: validSignals
                    });
                }
            }

            if (contextEvents.length > 0) {
                await prisma.contextLog.createMany({
                    data: contextEvents.map(e => ({
                        userId: e.userId,
                        timestamp: new Date(e.timestamp),
                        locationType: e.metadata?.locationType,
                        deviceType: e.metadata?.deviceType,
                        networkType: e.metadata?.networkType,
                        timeOfDay: e.metadata?.timeOfDay,
                        dayOfWeek: e.metadata?.dayOfWeek,
                        weather: e.metadata?.weather,
                        metadata: e.metadata
                    }))
                });
            }

        } catch (error) {
            console.error('Error in event ingestion worker:', error);
        }
    }, INTERVAL_MS);
};
