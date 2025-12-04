import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
    interface FastifyInstance {
        prisma: PrismaClient;
    }
}

import { prisma } from '../db';

const prismaPlugin: FastifyPluginAsync = fp(async (server, options) => {
    // const prisma = new PrismaClient(); // Removed


    await prisma.$connect();

    server.decorate('prisma', prisma);

    server.addHook('onClose', async (server) => {
        await server.prisma.$disconnect();
    });
});

export default prismaPlugin;
