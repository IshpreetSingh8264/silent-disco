import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

        // Attach user to request
        // @ts-ignore
        request.user = { userId: decoded.userId };
    } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
    }
};
