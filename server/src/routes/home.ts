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
        id: track.pipedId,
        artistId: track.artistRel?.pipedId // Use relation if available
    });

    // Helper to map API items
    const mapApiItem = (item: any) => ({
        url: `/api/music/streams/${item.videoId}`,
        title: item.name,
        thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || '',
        uploaderName: item.artist?.name || 'Unknown Artist',
        duration: parseDuration(item.duration),
        pipedId: item.videoId,
        artistId: item.artist?.browseId
    });

    fastify.get('/home', {
        preValidation: [fastify.authenticate]
    }, async (req, reply) => {
        const userId = (req.user as any).id;
        const { region = 'US' } = (req.query as any); // Default to US

        try {
            // --- PERSONAL SECTIONS (DB) ---

            // 1. Listen Again (History)
            const history = await fastify.prisma.listeningHistory.findMany({
                where: { userId },
                orderBy: { playedAt: 'desc' },
                distinct: ['trackId'],
                take: 20,
                include: { track: { include: { artistRel: true } } }
            });

            // 2. Your Playlists
            const playlists = await fastify.prisma.playlist.findMany({
                where: { userId },
                take: 10,
                include: { _count: { select: { tracks: true } } }
            });

            // 3. Quick Picks (Stats + API Enrichment)
            // Get top tracks from DB stats
            const topStats = await fastify.prisma.userTrackStats.findMany({
                where: { userId },
                orderBy: { playCount: 'desc' },
                take: 5,
                include: { track: { include: { artistRel: true } } }
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

            // Initialize YTMusic with Region
            const ytmusicRegion = new YTMusic();
            // Map region code if necessary (e.g. 'US' -> 'US', 'IN' -> 'IN')
            // YTMusic expects ISO 3166-1 alpha-2 country code
            await ytmusicRegion.initialize({ GL: region, HL: 'en' });

            // Fetch Home Sections (Personalized/Regional)
            let homeSections: any[] = [];
            try {
                homeSections = await ytmusicRegion.getHomeSections();
            } catch (e) {
                console.error("Failed to fetch home sections:", e);
            }

            // 4. Trending (Real-time API)
            const trendingCacheKey = `trending:${region}`;
            let trendingItems = [];
            const cachedTrending = await redis.get(trendingCacheKey);

            if (cachedTrending) {
                trendingItems = JSON.parse(cachedTrending);
            } else {
                try {
                    // Find "Trending" or "Top" section
                    const trendingSection = homeSections.find(s =>
                        (s.title.toLowerCase().includes('trending') || s.title.toLowerCase().includes('top')) &&
                        s.contents && s.contents.length > 0
                    );

                    if (trendingSection) {
                        // Map Home Section items
                        trendingItems = trendingSection.contents
                            .filter((i: any) => i.videoId) // Ensure it's a video/song
                            .map((item: any) => ({
                                url: `/api/music/streams/${item.videoId}`,
                                title: item.name, // Home sections use 'name'
                                thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || '',
                                uploaderName: item.artist?.name || 'Unknown Artist',
                                duration: 0, // Home sections often miss duration, set to 0
                                pipedId: item.videoId
                            }));
                    }

                    // Fallback to search if no section found or empty
                    if (trendingItems.length === 0) {
                        const query = `Top 50 ${region}`;
                        const songs = await ytmusicRegion.search(query);
                        trendingItems = songs.filter((i: any) => i.videoId).map(mapApiItem);
                    }

                    await redis.set(trendingCacheKey, JSON.stringify(trendingItems), 3600);
                } catch (e) {
                    console.error("Failed to fetch trending:", e);
                }
            }

            // 5. New Releases (Real-time API)
            const newReleasesCacheKey = `new_releases:${region}`;
            let newReleasesItems = [];
            const cachedNew = await redis.get(newReleasesCacheKey);

            if (cachedNew) {
                newReleasesItems = JSON.parse(cachedNew);
            } else {
                try {
                    // For New Releases, Home Sections usually return Albums.
                    // We want playable Songs. So we'll use Search "New Songs" which is reliable.
                    const songs = await ytmusicRegion.search('New Songs');
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
                            await fastify.prisma.track.update({
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
                id: track.pipedId,
                artistId: track.artistRel?.pipedId
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

            // 6. Popular Public Playlists
            const publicPlaylists = await fastify.prisma.playlist.findMany({
                where: { OR: [{ isPublic: true }, { isSystem: true }] },
                orderBy: { playCount: 'desc' },
                take: 10,
                include: { _count: { select: { tracks: true } } }
            });

            if (publicPlaylists.length > 0) {
                shelves.push({
                    title: "Popular Public Playlists",
                    items: publicPlaylists.map(p => ({
                        id: p.id,
                        title: p.name,
                        thumbnail: p.thumbnailUrl || '',
                        uploaderName: `${p._count.tracks} tracks`,
                        type: 'playlist',
                        url: `/library/playlist/${p.id}` // Frontend URL
                    }))
                });
            }

            // 7. Because you listened to... (Artist Recs)
            // Pick a random artist from top stats
            if (topStats.length > 0) {
                const randomStat = topStats[Math.floor(Math.random() * Math.min(topStats.length, 5))];
                const artistName = randomStat.track.artist;
                if (artistName) {
                    try {
                        // Fetch similar songs or artist top songs
                        // For now, let's search for "Similar to [Artist]" or just more from them
                        const songs = await ytmusicRegion.search(`Songs similar to ${artistName}`);
                        const recItems = songs.filter((i: any) => i.videoId).map(mapApiItem);
                        if (recItems.length > 0) {
                            shelves.push({ title: `Because you listened to ${artistName}`, items: recItems });
                        }
                    } catch (e) {
                        console.error("Failed to fetch artist recs:", e);
                    }
                }
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
