import { redis } from '../services/redis';
import { PrismaClient, SignalType } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 500;
const FLUSH_INTERVAL_MS = 10000;

interface AnalyticsEvent {
    userId: string;
    type: SignalType | 'PLAYED' | 'CONTEXT';
    trackId?: string;
    value?: number;
    metadata?: any;
    timestamp: string; // JSON stringify converts Date to string
}

async function processEvents() {
    await redis.connect();
    console.log('Event Processor started...');

    let buffer: AnalyticsEvent[] = [];
    let lastFlush = Date.now();

    while (true) {
        const rawEvent = await redis.rpop('events:buffer');

        if (rawEvent) {
            try {
                buffer.push(JSON.parse(rawEvent));
            } catch (e) {
                console.error('Failed to parse event:', rawEvent);
            }
        } else {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const timeSinceFlush = Date.now() - lastFlush;

        if (buffer.length >= BATCH_SIZE || (buffer.length > 0 && timeSinceFlush >= FLUSH_INTERVAL_MS)) {
            await flushBuffer(buffer);
            buffer = [];
            lastFlush = Date.now();
        }
    }
}

async function flushBuffer(events: AnalyticsEvent[]) {
    console.log(`Flushing ${events.length} events...`);

    const signals = events.filter(e => Object.values(SignalType).includes(e.type as SignalType));
    const history = events.filter(e => e.type === 'PLAYED');
    const context = events.filter(e => e.type === 'CONTEXT');

    if (signals.length > 0) {
        await prisma.userSignal.createMany({
            data: signals.map(e => ({
                userId: e.userId,
                trackId: e.trackId!,
                type: e.type as SignalType,
                value: e.value,
                metadata: e.metadata,
                createdAt: new Date(e.timestamp)
            }))
        });
    }

    if (history.length > 0) {
        await prisma.listeningHistory.createMany({
            data: history.map(e => ({
                userId: e.userId,
                trackId: e.trackId!,
                playedAt: new Date(e.timestamp),
                durationPlayed: e.value,
                context: e.metadata?.context
            }))
        });
    }

    if (context.length > 0) {
        await prisma.contextLog.createMany({
            data: context.map(e => ({
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
}

processEvents().catch(console.error);
