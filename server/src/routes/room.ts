import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { authenticate } from '../middleware/auth';

const roomRoutes: FastifyPluginAsync = async (server) => {
    const createRoomSchema = z.object({
        name: z.string().min(3),
    });

    server.post('/', { preHandler: authenticate }, async (request, reply) => {
        const { name } = createRoomSchema.parse(request.body);
        // @ts-ignore
        const userId = request.user.userId;

        const code = nanoid(6).toUpperCase();

        const room = await server.prisma.room.create({
            data: {
                name,
                code,
                hostId: userId,
            },
        });

        return room;
    });

    server.get('/:code', { preHandler: authenticate }, async (request, reply) => {
        const { code } = request.params as { code: string };

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

export default roomRoutes;
