import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

import { redis } from './services/redis';

const fastify = Fastify({
    logger: true
});

// Connect to Redis
redis.connect();

// Register plugins
fastify.register(cors, {
    origin: '*', // In production, lock this down
    methods: ['GET', 'POST', 'PUT', 'DELETE']
});

import prismaPlugin from './plugins/prisma';
import authRoutes from './routes/auth';
import { authenticate } from './middleware/auth';

import musicRoutes from './routes/music';
import roomRoutes from './routes/room';
import libraryRoutes from './routes/library';
import { setupRoomHandlers } from './socket/roomHandler';

fastify.register(prismaPlugin);
fastify.decorate('authenticate', authenticate);
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(musicRoutes, { prefix: '/api/music' });
fastify.register(roomRoutes, { prefix: '/api/rooms' });
fastify.register(libraryRoutes, { prefix: '/api/library' });

// We'll use socket.io for real-time, but keeping websocket plugin just in case
// fastify.register(websocket);

// Health check
fastify.get('/health', async () => {
    return { status: 'ok' };
});

const start = async () => {
    try {
        await fastify.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });

        // Initialize Socket.io
        const io = new Server(fastify.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        setupRoomHandlers(io, fastify.prisma);

        // Make io available via fastify decorator if needed, or just export it
        // For now, we'll keep it simple.

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
