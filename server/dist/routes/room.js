"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const nanoid_1 = require("nanoid");
const auth_1 = require("../middleware/auth");
const roomRoutes = async (server) => {
    const createRoomSchema = zod_1.z.object({
        name: zod_1.z.string().min(3),
    });
    server.post('/', { preHandler: auth_1.authenticate }, async (request, reply) => {
        const { name } = createRoomSchema.parse(request.body);
        // @ts-ignore
        const userId = request.user.id;
        const code = (0, nanoid_1.nanoid)(6).toUpperCase();
        const room = await server.prisma.room.create({
            data: {
                name,
                code,
                hostId: userId,
            },
        });
        return room;
    });
    server.get('/:code', { preHandler: auth_1.authenticate }, async (request, reply) => {
        const { code } = request.params;
        const room = await server.prisma.room.findUnique({
            where: { code },
            include: {
                host: { select: { username: true } },
                members: { include: { user: { select: { username: true } } } },
            },
        });
        if (!room) {
            return reply.status(404).send({ error: 'Room not found' });
        }
        return room;
    });
};
exports.default = roomRoutes;
