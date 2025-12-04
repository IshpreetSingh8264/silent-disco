import { FastifyInstance } from 'fastify';
import { searchService } from '../services/search';

export default async function searchRoutes(fastify: FastifyInstance) {

    // Typeahead / Suggestions
    fastify.get('/suggest', async (req, reply) => {
        const { q } = req.query as { q: string };
        if (!q) return [];

        try {
            // Use the new suggest method optimized for speed and sections
            const suggestions = await searchService.suggest(q);
            return { results: suggestions };
        } catch (err) {
            req.log.error(err);
            return { results: [] };
        }
    });

    // Full Search Results
    fastify.get('/', async (req, reply) => {
        const { q } = req.query as { q: string };
        if (!q) return { tracks: [], artists: [], albums: [], playlists: [] };

        try {
            const results = await searchService.search(q);
            return results;
        } catch (err) {
            req.log.error(err);
            return { tracks: [], artists: [], albums: [], playlists: [] };
        }
    });
}

