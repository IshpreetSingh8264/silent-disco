import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import YTMusic from 'ytmusic-api';
import { spawn } from 'child_process';
import path from 'path';
import { redis } from '../services/redis';

const musicRoutes: FastifyPluginAsync = async (server) => {
    const ytmusic = new YTMusic();
    await ytmusic.initialize();

    // Helper to parse duration string "MM:SS" to seconds
    const parseDuration = (duration: string | number): number => {
        if (typeof duration === 'number') return duration;
        if (!duration) return 0;
        const parts = duration.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 0;
    };

    // Helper to map YTMusic items to our app's format
    const mapItem = (item: any) => ({
        url: `/api/music/streams/${item.videoId}`, // Use relative URL with proxy
        title: item.name,
        thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || '',
        uploaderName: item.artist?.name || 'Unknown Artist',
        duration: parseDuration(item.duration),
        pipedId: item.videoId
    });

    server.get('/search', async (request, reply) => {
        const schema = z.object({
            q: z.string(),
            filter: z.string().optional(),
        });

        const { q } = schema.parse(request.query);
        const cacheKey = `search:${q}`;

        try {
            // Check cache
            const cached = await redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const songs = await ytmusic.search(q);
            // Filter out items without videoId (e.g. artists, albums)
            const validSongs = songs.filter((item: any) => item.videoId);
            const items = validSongs.map(mapItem);

            // Cache for 1 hour
            await redis.set(cacheKey, JSON.stringify({ items }), 3600);

            return { items };
        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to search music' });
        }
    });

    server.get('/trending', async (request, reply) => {
        const cacheKey = 'trending';
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            // getCharts might return different structure
            // If getCharts not available or complex, we can search for "top hits" or similar
            // But ytmusic-api usually has getCharts or similar.
            // Let's try getCharts, if fails we fallback.
            // Actually ytmusic-api documentation says `getHome()` or similar?
            // Let's assume `search('trending')` or `getCharts` works.
            // Checking common usage: `ytmusic.getCharts()` returns { countries: ... }
            // Maybe just search for "Top 100" as a fallback for now to be safe?
            // Or better, let's try to use `ytmusic.getCharts("US")`.

            // For safety/simplicity in this iteration without docs:
            const songs = await ytmusic.search('Top 50 Global');
            const validSongs = songs.filter((item: any) => item.videoId);
            const items = validSongs.map(mapItem);

            // Cache for 2 hours
            await redis.set(cacheKey, JSON.stringify(items), 7200);

            return items;
        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch trending' });
        }
    });

    server.get('/streams/:videoId', async (request, reply) => {
        const { videoId } = request.params as { videoId: string };

        try {
            const ytDlpPath = path.join(process.cwd(), 'bin', 'yt-dlp');

            const getStreamUrl = () => new Promise<string>((resolve, reject) => {
                const ytDlp = spawn(ytDlpPath, [
                    '-g',
                    '-f', 'bestaudio[ext=m4a]',
                    `https://www.youtube.com/watch?v=${videoId}`
                ]);

                let output = '';
                let error = '';

                ytDlp.stdout.on('data', (data) => {
                    output += data.toString();
                });

                ytDlp.stderr.on('data', (data) => {
                    error += data.toString();
                });

                ytDlp.on('close', (code) => {
                    if (code === 0) {
                        resolve(output.trim());
                    } else {
                        reject(new Error(`yt-dlp failed: ${error}`));
                    }
                });
            });

            const streamUrl = await getStreamUrl();
            return reply.redirect(streamUrl);

        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch stream' });
        }
    });

    server.get('/recommendations', async (request, reply) => {
        const schema = z.object({
            seedTrackId: z.string(),
            seedTrackTitle: z.string().optional(),
            seedTrackArtist: z.string().optional(),
            limit: z.string().optional().transform(Number)
        });

        const { seedTrackId, seedTrackTitle, seedTrackArtist, limit = 10 } = schema.parse(request.query);
        const cacheKey = `recommendations:${seedTrackId}:v2`; // Versioned cache key

        try {
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);

            // Smart Search Strategy
            // 1. Search for "Song Title" (finds the song and related covers/remixes/similar)
            // 2. Search for "Artist Name" (finds top songs by artist)
            // 3. Mix results

            const queries = [];
            if (seedTrackTitle) queries.push(seedTrackTitle);
            if (seedTrackArtist) queries.push(`${seedTrackArtist} top songs`);
            if (queries.length === 0) queries.push('trending music');

            const results = await Promise.all(queries.map(q => ytmusic.search(q)));

            // Flatten and deduplicate
            const allSongs = results.flat();
            const uniqueSongs = new Map();

            allSongs.forEach((item: any) => {
                if (item.videoId && item.videoId !== seedTrackId && !uniqueSongs.has(item.videoId)) {
                    uniqueSongs.set(item.videoId, item);
                }
            });

            // Shuffle/Interleave strategy could be better, but for now let's just take unique ones
            // Prioritize the first query's results (related to title)
            const validSongs = Array.from(uniqueSongs.values()).map(mapItem);

            // Randomize slightly to avoid same order every time if cached? 
            // No, cache is static. But we can shuffle before slicing.
            // For "Radio" feel, we want relevance.

            const items = validSongs.slice(0, limit || 10);

            await redis.set(cacheKey, JSON.stringify(items), 3600);
            return items;
        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch recommendations' });
        }
    });
    server.get('/home', async (request, reply) => {
        const cacheKey = 'home:shelves';
        try {
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);

            // Define shelves to fetch
            const shelvesConfig = [
                { title: 'Quick Picks', query: 'Mixed Pop Rock Hits' },
                { title: 'Trending Now', query: 'Top 50 Global' },
                { title: 'New Releases', query: 'New Music 2024' },
                { title: 'Forgotten Favorites', query: '2010s Top Hits' },
                { title: 'Hip Hop Essentials', query: 'Hip Hop Hits' },
                { title: 'Indie Vibes', query: 'Indie Pop' }
            ];

            // Fetch all shelves in parallel
            const shelvesData = await Promise.all(shelvesConfig.map(async (shelf) => {
                try {
                    const songs = await ytmusic.search(shelf.query);
                    const validSongs = songs
                        .filter((item: any) => item.videoId)
                        .slice(0, 10) // Limit to 10 items per shelf
                        .map(mapItem);

                    return {
                        title: shelf.title,
                        items: validSongs
                    };
                } catch (e) {
                    console.error(`Failed to fetch shelf: ${shelf.title}`, e);
                    return null;
                }
            }));

            const validShelves = shelvesData.filter(s => s && s.items.length > 0);

            await redis.set(cacheKey, JSON.stringify(validShelves), 3600); // Cache for 1 hour
            return validShelves;

        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch home data' });
        }
    });
};

export default musicRoutes;
