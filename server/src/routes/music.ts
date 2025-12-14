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
        // console.log(`[parseDuration] Input: ${duration} (${typeof duration})`);
        if (typeof duration === 'number') return duration;
        if (!duration) return 0;
        const parts = duration.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 0;
    };

    // Helper to map YTMusic items to our app's format
    const mapItem = (item: any) => {
        // console.log('[mapItem] Inspecting:', JSON.stringify(item));
        const type = item.type ? item.type.toLowerCase() : null;

        if (item.videoId) {
            return {
                type: 'song',
                url: `/api/music/streams/${item.videoId}`, // Use relative URL with proxy
                title: item.name || item.title,
                thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || '',
                uploaderName: item.artist?.name || 'Unknown Artist',
                duration: parseDuration(item.duration),
                pipedId: item.videoId,
                artistId: item.artist?.artistId || item.artist?.browseId
            };
        } else if (type === 'artist' || (item.artistId && !item.videoId)) {
            return {
                type: 'artist',
                id: item.browseId || item.artistId,
                title: item.name || item.title,
                thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || '',
                subscribers: item.subscribers
            };
        }

        if (type === 'playlist' || type === 'album' || (item.browseId?.startsWith('VL') || item.browseId?.startsWith('PL'))) {
            return {
                type: 'playlist',
                id: item.browseId || item.playlistId || item.albumId,
                title: item.name || item.title,
                thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || '',
                count: item.count || item.trackCount || item.itemCount || 0,
                uploaderName: item.artist?.name || 'Unknown',
                isAlbum: type === 'album' // Flag to distinguish
            };
        }
        return null;
    };

    server.get('/search', async (request, reply) => {
        const schema = z.object({
            q: z.string(),
            filter: z.string().optional(),
        });

        const { q } = schema.parse(request.query);
        const cacheKey = `search:${q}:v2`;

        try {
            // Check cache
            const cached = await redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const results = await ytmusic.search(q);
            console.log(`[Search] Query: ${q}, Raw Results:`, JSON.stringify(results.slice(0, 5), null, 2)); // Log first 5 items
            const items = results.map(mapItem).filter((i: any) => i !== null);

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

    // yt-dlp OPTIMIZED - uses Android client (skips slow signature deciphering)
    // Expected speed: ~2-5 seconds instead of 15-20 seconds
    const getStreamUrl = (videoId: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const proc = spawn('yt-dlp', [
                '-g',                                                    // Get URL only
                '-f', 'bestaudio',                                       // Best audio format
                '--extractor-args', 'youtube:player_client=android',     // Android client = FAST
                '--no-playlist',                                         // Single video only
                '--skip-download',                                       // Don't download
                '--quiet',                                               // No progress
                '--no-warnings',                                         // No warnings
                '--socket-timeout', '5',                                 // 5 second timeout
                `https://www.youtube.com/watch?v=${videoId}`
            ]);
            let out = '';
            const t = setTimeout(() => { proc.kill(); reject(new Error('yt-dlp timeout')); }, 15000);
            proc.stdout.on('data', (d: Buffer) => out += d.toString());
            proc.on('close', (c: number) => {
                clearTimeout(t);
                const u = out.trim().split('\n')[0];
                c === 0 && u?.startsWith('http') ? resolve(u) : reject(new Error('yt-dlp failed'));
            });
            proc.on('error', () => { clearTimeout(t); reject(new Error('yt-dlp error')); });
        });
    };

    server.get('/streams/:videoId', async (request, reply) => {
        const { videoId } = request.params as { videoId: string };
        if (!videoId || videoId === 'undefined') return reply.status(400).send({ error: 'Invalid video ID' });

        try {
            const start = Date.now();
            const url = await getStreamUrl(videoId);
            const elapsed = Date.now() - start;
            server.log.info(`[yt-dlp] ✓ ${videoId} (${elapsed}ms)`);
            return { url };
        } catch (e: any) {
            server.log.error(`[yt-dlp] Failed: ${videoId} - ${e.message}`);
            return reply.status(500).send({ error: 'Failed to fetch stream' });
        }
    });

    server.get('/recommendations', { preValidation: [server.authenticate] }, async (request, reply) => {
        const schema = z.object({
            seedTrackId: z.string(),
            seedTrackTitle: z.string().optional(),
            seedTrackArtist: z.string().optional(),
            historyIds: z.string().optional(), // Comma-separated list of last played track IDs
            limit: z.string().optional().transform(Number)
        });

        const { seedTrackId, seedTrackTitle, seedTrackArtist, historyIds, limit = 20 } = schema.parse(request.query);
        const cacheKey = `recommendations:${seedTrackId}:${historyIds || 'none'}:v9`;

        try {
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);

            let validSongs: any[] = [];
            const historyList = historyIds ? historyIds.split(',') : [];

            // Fetch user context for AI
            let likedTrackIds: string[] = [];
            let topArtists: string[] = [];

            if (request.user) {
                const userId = (request.user as any).id;

                // Get Liked Tracks
                const liked = await server.prisma.likedTrack.findMany({
                    where: { userId },
                    select: { trackId: true, track: { select: { pipedId: true } } },
                    take: 50,
                    orderBy: { likedAt: 'desc' }
                });
                likedTrackIds = liked.map(l => l.track.pipedId);

                // Get Top Artists
                const stats = await server.prisma.userTrackStats.findMany({
                    where: { userId },
                    include: { track: true },
                    orderBy: { playCount: 'desc' },
                    take: 20
                });
                topArtists = Array.from(new Set(stats.map(s => s.track.artist).filter(Boolean)));
            }

            // Try Python AI Engine first (via CLI)
            try {
                const pythonScriptPath = path.join(process.cwd(), 'ai', 'recommend.py');
                const pythonProcess = spawn('python', [pythonScriptPath]);

                const inputData = JSON.stringify({
                    userId: request.user?.userId || 'anonymous',
                    context: 'radio',
                    recentHistory: [seedTrackId, ...historyList],
                    likedTracks: likedTrackIds,
                    topArtists: topArtists,
                    limit: limit
                });

                let stdoutData = '';
                let stderrData = '';

                const aiPromise = new Promise<any>((resolve, reject) => {
                    pythonProcess.stdout.on('data', (data) => {
                        stdoutData += data.toString();
                    });

                    pythonProcess.stderr.on('data', (data) => {
                        stderrData += data.toString();
                    });

                    pythonProcess.on('close', (code) => {
                        if (code === 0) {
                            try {
                                resolve(JSON.parse(stdoutData));
                            } catch (e) {
                                reject(new Error(`Failed to parse Python output: ${e}`));
                            }
                        } else {
                            reject(new Error(`Python script exited with code ${code}: ${stderrData}`));
                        }
                    });

                    pythonProcess.on('error', (err) => {
                        reject(err);
                    });

                    // Write input to stdin
                    pythonProcess.stdin.write(inputData);
                    pythonProcess.stdin.end();
                });

                const aiData = await aiPromise;

                if (aiData.recommendations && aiData.recommendations.length > 0) {
                    validSongs = aiData.recommendations.map((item: any) => ({
                        url: `/api/music/streams/${item.pipedId}`,
                        title: item.title,
                        thumbnail: item.thumbnail,
                        uploaderName: item.uploaderName,
                        duration: typeof item.duration === 'string' ? parseDuration(item.duration) : item.duration,
                        pipedId: item.pipedId
                    }));
                    console.log(`[Recommendations] AI Engine returned ${validSongs.length} tracks`);
                }
            } catch (err) {
                console.warn('[Recommendations] AI Engine unavailable, falling back to local logic', err);
            }

            // Fallback to local logic if AI failed or returned nothing
            if (validSongs.length === 0) {
                try {
                    // Primary strategy: Native "Up Next"
                    const upNext = await ytmusic.getUpNexts(seedTrackId);
                    validSongs = upNext
                        .filter((item: any) => item.videoId && item.videoId !== seedTrackId && !historyList.includes(item.videoId))
                        .map((item: any) => ({
                            url: `/api/music/streams/${item.videoId}`,
                            title: item.title,
                            thumbnail: item.thumbnail || '',
                            uploaderName: Array.isArray(item.artists) ? item.artists.map((a: any) => a.name).join(', ') : (item.artist?.name || 'Unknown Artist'),
                            duration: parseDuration(item.duration),
                            pipedId: item.videoId
                        }));
                } catch (err) {
                    console.warn(`[Recommendations] getUpNexts failed for ${seedTrackId}, falling back to search`, err);
                }
            }

            // "Vibe" Injection: If we have history, fetch related tracks for the previous track too
            if (historyList.length > 0 && validSongs.length < (limit || 20)) {
                try {
                    const lastTrackId = historyList[0]; // Most recent history item
                    const secondaryRecs = await ytmusic.getUpNexts(lastTrackId);
                    const secondarySongs = secondaryRecs
                        .filter((item: any) => item.videoId && item.videoId !== seedTrackId && !historyList.includes(item.videoId))
                        .map((item: any) => ({
                            url: `/api/music/streams/${item.videoId}`,
                            title: item.title,
                            thumbnail: item.thumbnail || '',
                            uploaderName: Array.isArray(item.artists) ? item.artists.map((a: any) => a.name).join(', ') : (item.artist?.name || 'Unknown Artist'),
                            duration: parseDuration(item.duration),
                            pipedId: item.videoId
                        }));

                    // Interleave results: 2 from primary, 1 from secondary
                    const combined: any[] = [];
                    let p = 0, s = 0;
                    while (p < validSongs.length || s < secondarySongs.length) {
                        if (p < validSongs.length) combined.push(validSongs[p++]);
                        if (p < validSongs.length) combined.push(validSongs[p++]);
                        if (s < secondarySongs.length) combined.push(secondarySongs[s++]);
                    }
                    validSongs = combined;
                } catch (err) {
                    console.warn(`[Recommendations] Secondary fetch failed`, err);
                }
            }

            // Fallback strategy: Search
            if (validSongs.length === 0) {
                const query = seedTrackTitle ? `Songs similar to ${seedTrackTitle} ${seedTrackArtist || ''}` : 'Trending music';
                const searchResults = await ytmusic.search(query);
                validSongs = searchResults
                    .filter((item: any) => item.videoId && item.videoId !== seedTrackId)
                    .map(mapItem);
            }

            // Remove duplicates
            const uniqueSongs = Array.from(new Map(validSongs.map(item => [item.pipedId, item])).values());
            const items = uniqueSongs.slice(0, limit || 20);

            if (items.length > 0) {
                await redis.set(cacheKey, JSON.stringify(items), 3600);
                console.log('[Recommendations] Returning items. First item:', JSON.stringify(items[0], null, 2));
            }

            return items;
        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch recommendations' });
        }
    });

};

export default musicRoutes;
