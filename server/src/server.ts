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
import artistRoutes from './routes/artists';
import publicPlaylistRoutes from './routes/publicPlaylists';
import userRoutes from './routes/user';
import homeRoutes from './routes/home';
import eventRoutes from './routes/events';
import searchRoutes from './routes/search';
import albumRoutes from './routes/albums';
import { setupRoomHandlers } from './socket/roomHandler';
import { startWorker } from './workers/eventIngestion';

// Start background workers
startWorker();

// ... (existing code)

fastify.register(prismaPlugin);
fastify.decorate('authenticate', authenticate);
fastify.register(authRoutes, { prefix: '/api/auth' });

import queueRoutes from './routes/queue';

fastify.register(musicRoutes, { prefix: '/api/music' });
fastify.register(roomRoutes, { prefix: '/api/rooms' });
fastify.register(libraryRoutes, { prefix: '/api/library' });
fastify.register(userRoutes, { prefix: '/api/user' });
fastify.register(homeRoutes, { prefix: '/api/music' }); // Register under /api/music/home
fastify.register(eventRoutes, { prefix: '/api/events' });
fastify.register(searchRoutes, { prefix: '/api/search' });
fastify.register(queueRoutes, { prefix: '/api/queue' });
fastify.register(artistRoutes, { prefix: '/api/artists' });
fastify.register(albumRoutes, { prefix: '/api/albums' });
fastify.register(publicPlaylistRoutes, { prefix: '/api/playlists/public' });

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
