import Redis from 'ioredis';

class RedisService {
    private client: Redis | null = null;
    private isConnected = false;

    constructor() {
        // Initialize lazily or in connect()
    }

    async connect() {
        if (this.isConnected) return;

        try {
            this.client = new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                }
            });

            this.client.on('connect', () => {
                console.log('Redis connected');
                this.isConnected = true;
            });

            this.client.on('error', (err) => {
                console.error('Redis error:', err);
            });

        } catch (error) {
            console.error('Failed to connect to Redis:', error);
        }
    }

    async get(key: string): Promise<string | null> {
        if (!this.client) return null;
        return this.client.get(key);
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (!this.client) return;
        if (ttlSeconds) {
            await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
            await this.client.set(key, value);
        }
    }

    async del(key: string): Promise<void> {
        if (!this.client) return;
        await this.client.del(key);
    }

    async flush(): Promise<void> {
        if (!this.client) return;
        await this.client.flushall();
    }
}

export const redis = new RedisService();
