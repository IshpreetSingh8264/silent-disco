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

    // ============================================
    // TWO-PHASE AUDIO STREAMING
    // Phase 1: Fast metadata with yt-dlp -j (~200-800ms)
    // Phase 2: Byte-range proxy to YouTube CDN
    // Supports: seeking, timeline, progress bar
    // ============================================

    interface AudioMetadata {
        url: string;
        contentLength: number;
        duration: number;
        mimeType: string;
    }

    // Get fast metadata using yt-dlp -j
    const getAudioMetadata = async (videoId: string): Promise<AudioMetadata> => {
        const cacheKey = `audio:meta:${videoId}`;

        // Check Redis cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        return new Promise((resolve, reject) => {
            const proc = spawn('yt-dlp', [
                '-j',                    // JSON output (fast, metadata only)
                '--no-playlist',
                '-f', 'bestaudio[ext=m4a]/bestaudio',
                `https://www.youtube.com/watch?v=${videoId}`
            ]);

            let stdout = '';
            let stderr = '';
            const timeout = setTimeout(() => {
                proc.kill();
                reject(new Error('Metadata timeout'));
            }, 10000);

            proc.stdout.on('data', (d: Buffer) => stdout += d.toString());
            proc.stderr.on('data', (d: Buffer) => stderr += d.toString());

            proc.on('close', async (code: number) => {
                clearTimeout(timeout);
                if (code !== 0) {
                    return reject(new Error(stderr || `Exit code ${code}`));
                }

                try {
                    const info = JSON.parse(stdout);
                    const format = info.requested_formats?.[0] || info;

                    const metadata: AudioMetadata = {
                        url: format.url,
                        contentLength: format.filesize || format.filesize_approx || 0,
                        duration: info.duration || 0,
                        mimeType: format.acodec?.includes('mp4a') ? 'audio/mp4' : 'audio/webm'
                    };

                    // Cache for 5 minutes (YouTube URLs expire after ~6 hours)
                    await redis.set(cacheKey, JSON.stringify(metadata), 300);
                    resolve(metadata);
                } catch (e: any) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });

            proc.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    };

    // Audio endpoint with byte-range proxy support
    server.get('/audio/:videoId', async (request, reply) => {
        const { videoId } = request.params as { videoId: string };

        if (!videoId || videoId === 'undefined') {
            return reply.status(400).send({ error: 'Invalid video ID' });
        }

        try {
            // Phase 1: Get metadata fast (~200-800ms)
            const startTime = Date.now();
            const metadata = await getAudioMetadata(videoId);
            server.log.info(`[audio] Metadata: ${videoId} (${Date.now() - startTime}ms)`);

            // Parse Range header if present
            const rangeHeader = request.headers.range;
            let start = 0;
            let end = metadata.contentLength - 1;

            if (rangeHeader && metadata.contentLength > 0) {
                const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
                if (match) {
                    start = match[1] ? parseInt(match[1], 10) : 0;
                    end = match[2] ? parseInt(match[2], 10) : metadata.contentLength - 1;
                }
            }

            const contentLength = end - start + 1;

            // Phase 2: Proxy to YouTube CDN with Range support
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };
            if (rangeHeader) {
                headers['Range'] = `bytes=${start}-${end}`;
            }

            const response = await fetch(metadata.url, { headers });

            if (!response.ok) {
                return reply.status(response.status).send({ error: 'Upstream error' });
            }

            // Set response headers
            const statusCode = rangeHeader ? 206 : 200;
            const responseHeaders: Record<string, string> = {
                'Content-Type': metadata.mimeType,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=300'
            };

            if (metadata.contentLength > 0) {
                responseHeaders['Content-Length'] = contentLength.toString();
                if (rangeHeader) {
                    responseHeaders['Content-Range'] = `bytes ${start}-${end}/${metadata.contentLength}`;
                }
            }

            reply.raw.writeHead(statusCode, responseHeaders);

            // Stream response body to client
            const reader = response.body?.getReader();
            if (!reader) {
                return reply.raw.end();
            }

            let clientDisconnected = false;
            request.raw.on('close', () => {
                clientDisconnected = true;
            });

            const pump = async () => {
                try {
                    while (!clientDisconnected) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        reply.raw.write(value);
                    }
                } catch (e) {
                    // Client disconnected
                } finally {
                    try { reader.cancel(); } catch (e) { /* ignore */ }
                    try { reply.raw.end(); } catch (e) { /* ignore */ }
                }
            };

            pump();
            return reply;

        } catch (e: any) {
            server.log.error(`[audio] Error: ${videoId} - ${e.message}`);
            return reply.status(500).send({ error: 'Failed to get audio' });
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
