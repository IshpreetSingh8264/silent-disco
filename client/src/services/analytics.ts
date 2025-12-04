import { useAuthStore } from '../store/useAuthStore';

interface AnalyticsEvent {
    userId: string;
    type: string;
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

class AnalyticsService {
    private buffer: AnalyticsEvent[] = [];
    private flushInterval: number | null = null;
    private readonly FLUSH_DELAY = 10000; // 10 seconds
    private readonly BATCH_SIZE = 50;

    constructor() {
        this.startFlushTimer();
    }

    private startFlushTimer() {
        if (this.flushInterval) clearInterval(this.flushInterval);
        this.flushInterval = setInterval(() => this.flush(), this.FLUSH_DELAY);
    }

    public track(type: string, data: Partial<Omit<AnalyticsEvent, 'userId' | 'type' | 'timestamp'>>) {
        const user = useAuthStore.getState().user;
        if (!user) return;

        const event: AnalyticsEvent = {
            userId: user.id,
            type,
            timestamp: new Date(),
            ...data
        };

        this.buffer.push(event);

        if (this.buffer.length >= this.BATCH_SIZE) {
            this.flush();
        }
    }

    private async flush() {
        if (this.buffer.length === 0) return;

        const eventsToSend = [...this.buffer];
        this.buffer = [];

        try {
            await fetch('/api/events/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${useAuthStore.getState().token}`
                },
                body: JSON.stringify(eventsToSend)
            });
        } catch (error) {
            console.error('Failed to flush analytics events:', error);
            // Optionally re-queue failed events, but be careful of infinite loops
        }
    }
}

export const analytics = new AnalyticsService();
