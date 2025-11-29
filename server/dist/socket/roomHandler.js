"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoomHandlers = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient(); // Ideally pass this from server instance
const setupRoomHandlers = (io) => {
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);
        socket.on('join_room', async ({ roomCode, userId }) => {
            const room = await prisma.room.findUnique({ where: { code: roomCode } });
            if (room) {
                socket.join(roomCode);
                console.log(`User ${userId} joined room ${roomCode}`);
                // Add member to DB
                await prisma.roomMember.create({
                    data: {
                        userId,
                        roomId: room.id
                    }
                }).catch(() => { }); // Ignore if already exists (should handle better)
                io.to(roomCode).emit('user_joined', { userId });
            }
        });
        socket.on('play', ({ roomCode, track, position }) => {
            socket.to(roomCode).emit('play', { track, position });
            // Update DB state
        });
        socket.on('pause', ({ roomCode }) => {
            socket.to(roomCode).emit('pause');
        });
        socket.on('seek', ({ roomCode, position }) => {
            socket.to(roomCode).emit('seek', { position });
        });
        socket.on('queue_add', ({ roomCode, track }) => {
            io.to(roomCode).emit('queue_add', { track });
        });
        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });
};
exports.setupRoomHandlers = setupRoomHandlers;
