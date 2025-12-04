import { FastifyInstance } from 'fastify';
import { searchService } from '../services/search';

export default async function searchRoutes(fastify: FastifyInstance) {
    fastify.get('/suggest', async (req, reply) => {
        const { q } = req.query as { q: string };
        if (!q || q.length < 2) return [];

        try {
            const hits = await searchService.search(q);
            return hits;
        } catch (err) {
            req.log.error(err);
            return [];
        }
    });
}
