import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import YTMusic from 'ytmusic-api';
import { redis } from '../services/redis';

const prisma = new PrismaClient();

export default async function homeRoutes(fastify: FastifyInstance) {
    const ytmusic = new YTMusic();
    await ytmusic.initialize();

    // Helper to parse duration
    const parseDuration = (duration: string | number): number => {
        if (typeof duration === 'number') return duration;
        if (!duration) return 0;
        const parts = duration.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 0;
    };

    // Helper to map DB items to app format
    const mapDbTrack = (track: any) => ({
        url: `/api/music/streams/${track.pipedId}`,
        title: track.title,
        thumbnail: track.thumbnailUrl || '', // Map thumbnailUrl to thumbnail
        uploaderName: track.artist || 'Unknown Artist',
        duration: track.duration,
        pipedId: track.pipedId,
        id: track.pipedId
    });

    // Helper to map API items
    const mapApiItem = (item: any) => ({
        url: `/api/music/streams/${item.videoId}`,
        title: item.name,
        thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || '',
        uploaderName: item.artist?.name || 'Unknown Artist',
        duration: parseDuration(item.duration),
        pipedId: item.videoId
    });

    fastify.get('/home', {
        preValidation: [fastify.authenticate]
    }, async (req, reply) => {
        const userId = (req.user as any).id;
        const { region = 'US' } = (req.query as any); // Default to US

        try {
            // --- PERSONAL SECTIONS (DB) ---

            // 1. Listen Again (History)
            const history = await prisma.listeningHistory.findMany({
                where: { userId },
                orderBy: { playedAt: 'desc' },
                distinct: ['trackId'],
                take: 20,
                include: { track: true }
            });

            // 2. Your Playlists
            const playlists = await prisma.playlist.findMany({
                where: { userId },
                take: 10,
                include: { _count: { select: { tracks: true } } }
            });

            // 3. Quick Picks (Stats + API Enrichment)
            // Get top tracks from DB stats
            const topStats = await prisma.userTrackStats.findMany({
                where: { userId },
                orderBy: { playCount: 'desc' },
                take: 5,
                include: { track: true }
            });

            let quickPicksItems: any[] = [];
            if (topStats.length > 0) {
                // If we have stats, use them. 
                // OPTIONAL: We could also fetch "Similar to" these tracks from API for a better "Quick Picks" mix.
                // For now, let's just show the top tracks themselves as "Quick Picks" (Favorites).
                // Map DB tracks to frontend format
                quickPicksItems = topStats.map(s => mapDbTrack(s.track));
            } else {
                // Cold Start: Fetch generic "Quick Picks" from API
                const cacheKey = 'quick_picks:generic';
                const cached = await redis.get(cacheKey);
                if (cached) {
                    quickPicksItems = JSON.parse(cached);
                } else {
                    const songs = await ytmusic.search('Mixed Pop Hits');
                    quickPicksItems = songs.filter((i: any) => i.videoId).map(mapApiItem);
                    await redis.set(cacheKey, JSON.stringify(quickPicksItems), 3600);
                }
            }

            // --- GLOBAL SECTIONS (API) ---

            // 4. Trending (Real-time API)
            const trendingCacheKey = `trending:${region}`;
            let trendingItems = [];
            const cachedTrending = await redis.get(trendingCacheKey);

            if (cachedTrending) {
                trendingItems = JSON.parse(cachedTrending);
            } else {
                try {
                    // ytmusic.getCharts(region) is ideal, but if not supported, search "Top 50 <Region>"
                    // The library might not support region code in getCharts directly depending on version.
                    // Let's try a search fallback which is robust.
                    const query = `Top 50 ${region}`;
                    const songs = await ytmusic.search(query);
                    trendingItems = songs.filter((i: any) => i.videoId).map(mapApiItem);
                    await redis.set(trendingCacheKey, JSON.stringify(trendingItems), 3600);
                } catch (e) {
                    console.error("Failed to fetch trending:", e);
                }
            }

            // 5. New Releases (Real-time API)
            const newReleasesCacheKey = 'new_releases';
            let newReleasesItems = [];
            const cachedNew = await redis.get(newReleasesCacheKey);

            if (cachedNew) {
                newReleasesItems = JSON.parse(cachedNew);
            } else {
                try {
                    // Try getNewReleases() if available, else search "New Music"
                    // ytmusic-api usually has getNewReleases()
                    // If not, fallback to search
                    const songs = await ytmusic.search('New Music 2024'); // Fallback search
                    newReleasesItems = songs.filter((i: any) => i.videoId).map(mapApiItem);
                    await redis.set(newReleasesCacheKey, JSON.stringify(newReleasesItems), 3600);
                } catch (e) {
                    console.error("Failed to fetch new releases:", e);
                }
            }

            // --- ENRICHMENT LOGIC ---
            // Check if any personal tracks (history/stats) are missing thumbnails
            const tracksToEnrich = [
                ...history.map(h => h.track),
                ...topStats.map(s => s.track)
            ].filter(t => !t.thumbnailUrl || t.thumbnailUrl === '');

            // Deduplicate track IDs
            const uniqueTrackIds = Array.from(new Set(tracksToEnrich.map(t => t.id)));
            const enrichedThumbnails = new Map<string, string>();

            if (uniqueTrackIds.length > 0) {
                console.log(`Enriching ${uniqueTrackIds.length} tracks with missing thumbnails...`);
                await Promise.all(uniqueTrackIds.map(async (id) => {
                    try {
                        // Find the track object (any instance) to get pipedId
                        const track = tracksToEnrich.find(t => t.id === id);
                        if (!track) return;

                        const song = await ytmusic.getSong(track.pipedId);
                        if (song && song.thumbnails && song.thumbnails.length > 0) {
                            const newThumbnail = song.thumbnails[song.thumbnails.length - 1].url;
                            // Update DB
                            await prisma.track.update({
                                where: { id },
                                data: { thumbnailUrl: newThumbnail }
                            });
                            // Store in Map
                            enrichedThumbnails.set(id, newThumbnail);
                        }
                    } catch (err) {
                        console.error(`Failed to enrich track ${id}:`, err);
                    }
                }));
            }

            // Helper to get thumbnail (from Map, or Track, or Placeholder)
            const getThumbnail = (track: any) => {
                return enrichedThumbnails.get(track.id) || track.thumbnailUrl || '';
            };

            // Update mapDbTrack to use the new helper if needed, 
            // but since mapDbTrack is defined above, we can just manually map here or redefine it.
            // Let's just manually map for the shelves to ensure we use the enriched data.

            const mapEnrichedTrack = (track: any) => ({
                url: `/api/music/streams/${track.pipedId}`,
                title: track.title,
                thumbnail: getThumbnail(track),
                uploaderName: track.artist || 'Unknown Artist',
                duration: track.duration,
                pipedId: track.pipedId,
                id: track.pipedId
            });

            // --- ASSEMBLE SHELVES ---
            const shelves = [];

            if (quickPicksItems.length > 0) {
                // Re-map Quick Picks using enriched data
                if (topStats.length > 0) {
                    quickPicksItems = topStats.map(s => mapEnrichedTrack(s.track));
                }
                shelves.push({ title: "Quick Picks", items: quickPicksItems });
            }

            if (history.length > 0) {
                // Re-map history using enriched data
                shelves.push({ title: "Listen Again", items: history.map(h => mapEnrichedTrack(h.track)) });
            }

            if (trendingItems.length > 0) {
                shelves.push({ title: `Trending in ${region}`, items: trendingItems });
            }

            if (newReleasesItems.length > 0) {
                shelves.push({ title: "New Releases", items: newReleasesItems });
            }

            // Add Playlists if needed, or handle separately
            // shelves.push({ title: "Your Playlists", items: playlists... }) 
            // Playlists usually have a different UI card, so maybe send them as a separate field?
            // For now, adhering to the "Shelves" structure for tracks.

            return shelves;

        } catch (error) {
            console.error("Home aggregation error:", error);
            reply.status(500).send({ error: "Failed to fetch home data" });
        }
    });
}
