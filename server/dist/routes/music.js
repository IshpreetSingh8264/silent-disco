"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const PIPED_API = 'https://pipedapi.kavin.rocks';
const musicRoutes = async (server) => {
    server.get('/search', async (request, reply) => {
        const schema = zod_1.z.object({
            q: zod_1.z.string(),
            filter: zod_1.z.enum(['all', 'videos', 'playlists', 'music_songs', 'music_videos', 'music_albums', 'music_playlists']).optional().default('all'),
        });
        const { q, filter } = schema.parse(request.query);
        try {
            const response = await fetch(`${PIPED_API}/search?q=${encodeURIComponent(q)}&filter=${filter}`);
            const data = await response.json();
            return data;
        }
        catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch from Piped' });
        }
    });
    server.get('/streams/:videoId', async (request, reply) => {
        const { videoId } = request.params;
        try {
            const response = await fetch(`${PIPED_API}/streams/${videoId}`);
            const data = await response.json();
            return data;
        }
        catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch streams' });
        }
    });
    // Add more endpoints for trending, playlists, etc.
};
exports.default = musicRoutes;
