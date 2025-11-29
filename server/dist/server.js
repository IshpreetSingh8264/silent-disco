"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const fastify = (0, fastify_1.default)({ logger: true });
// Register plugins
fastify.register(cors_1.default, {
    origin: '*', // Allow all for now, lock down in prod
});
const prisma_1 = __importDefault(require("./plugins/prisma"));
const auth_1 = __importDefault(require("./routes/auth"));
const music_1 = __importDefault(require("./routes/music"));
const room_1 = __importDefault(require("./routes/room"));
const roomHandler_1 = require("./socket/roomHandler");
fastify.register(prisma_1.default);
fastify.register(auth_1.default, { prefix: '/api/auth' });
fastify.register(music_1.default, { prefix: '/api/music' });
fastify.register(room_1.default, { prefix: '/api/rooms' });
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
        const io = new socket_io_1.Server(fastify.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        (0, roomHandler_1.setupRoomHandlers)(io);
        // Make io available via fastify decorator if needed, or just export it
        // For now, we'll keep it simple.
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
