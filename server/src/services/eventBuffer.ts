import { redis } from './redis';
import { SignalType } from '@prisma/client';

export interface AnalyticsEvent {
    userId: string;
    type: SignalType | 'PLAYED' | 'CONTEXT'; // Extend for internal types
    trackId?: string;
    value?: number;
    metadata?: any;
    trackDetails?: {
        title: string;
        artist: string;
        thumbnailUrl: string;
        duration: number;
    };
    timestamp: Date;
}

export const bufferEvent = async (event: AnalyticsEvent) => {
    await redis.lpush('events:buffer', JSON.stringify(event));
};
