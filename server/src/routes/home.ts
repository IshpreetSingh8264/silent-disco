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
        const { region = 'US', category } = (req.query as any);

        try {
            // Initialize YTMusic with Region
            const ytmusicRegion = new YTMusic();
            await ytmusicRegion.initialize({ GL: region, HL: 'en' });

            // --- CATEGORY SEARCH ---
            if (category) {
                // If a category is selected (e.g. "Energize"), search for it
                const query = `${category} songs`;
                const songs = await ytmusicRegion.search(query);
                const items = songs.filter((i: any) => i.videoId).map(mapApiItem);
                return [{
                    title: category,
                    items: items
                }];
            }

            // --- DEFAULT HOME ---

            // 1. Listen Again (History)
            const history = await fastify.prisma.listeningHistory.findMany({
                where: { userId },
                orderBy: { playedAt: 'desc' },
                distinct: ['trackId'],
                take: 20,
                include: { track: { include: { artistRel: true } } }
            });

            // 2. Quick Picks (Stats)
            const topStats = await fastify.prisma.userTrackStats.findMany({
                where: { userId },
                orderBy: { playCount: 'desc' },
                take: 5,
                include: { track: { include: { artistRel: true } } }
            });

            let quickPicksItems: any[] = [];
            if (topStats.length > 0) {
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

            // Fetch Home Sections (Personalized/Regional)
            let homeSections: any[] = [];
            try {
                homeSections = await ytmusicRegion.getHomeSections();
            } catch (e) {
                console.error("Failed to fetch home sections:", e);
            }

            // 3. Trending (From Home Sections)
            let trendingItems: any[] = [];
            // Look for "Top music videos", "Trending", "Charts"
            const trendingSection = homeSections.find(s =>
                /trending|top music videos|charts/i.test(s.title) && s.contents?.length > 0
            );

            if (trendingSection) {
                trendingItems = trendingSection.contents
                    .filter((i: any) => i.videoId)
                    .map(mapApiItem);
            }

            // Fallback for Trending if not found in sections
            if (trendingItems.length === 0) {
                const cacheKey = `trending:${region}`;
                const cached = await redis.get(cacheKey);
                if (cached) {
                    trendingItems = JSON.parse(cached);
                } else {
                    // Search for "Top 50 [Region]" as fallback
                    const query = `Top 50 ${region}`;
                    const songs = await ytmusicRegion.search(query);
                    trendingItems = songs.filter((i: any) => i.videoId).map(mapApiItem);
                    await redis.set(cacheKey, JSON.stringify(trendingItems), 3600);
                }
            }

            // 4. New Releases (From Home Sections)
            let newReleasesItems: any[] = [];
            const newReleasesSection = homeSections.find(s =>
                /new releases/i.test(s.title) && s.contents?.length > 0
            );

            if (newReleasesSection) {
                // New Releases are often Albums/Singles. We map them.
                newReleasesItems = newReleasesSection.contents.map((item: any) => {
                    const id = item.browseId || item.albumId || item.playlistId;
                    if ((item.type === 'ALBUM' || item.type === 'SINGLE') && id) {
                        return {
                            id: id,
                            pipedId: id,
                            title: item.title || item.name,
                            thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || '',
                            uploaderName: item.artist?.name || item.subtitle || 'Unknown',
                            type: 'album',
                            url: `/library/playlist/${id}`
                        };
                    } else if (item.videoId) {
                        return mapApiItem(item);
                    }
                    return null;
                }).filter(Boolean);
            } else {
                // Fallback: Search "New Songs" (less accurate but better than nothing)
                const cacheKey = `new_releases:${region}`;
                const cached = await redis.get(cacheKey);
                if (cached) {
                    newReleasesItems = JSON.parse(cached);
                } else {
                    const songs = await ytmusicRegion.search('New Songs');
                    newReleasesItems = songs.filter((i: any) => i.videoId).map(mapApiItem);
                    await redis.set(cacheKey, JSON.stringify(newReleasesItems), 3600);
                }
            }

            // --- ENRICHMENT (Thumbnails) ---
            // ... (Keep existing enrichment logic for history/stats) ...
            const tracksToEnrich = [
                ...history.map(h => h.track),
                ...topStats.map(s => s.track)
            ].filter(t => !t.thumbnailUrl || t.thumbnailUrl === '');

            const uniqueTrackIds = Array.from(new Set(tracksToEnrich.map(t => t.id)));
            const enrichedThumbnails = new Map<string, string>();

            if (uniqueTrackIds.length > 0) {
                await Promise.all(uniqueTrackIds.map(async (id) => {
                    try {
                        const track = tracksToEnrich.find(t => t.id === id);
                        if (!track) return;
                        const song = await ytmusic.getSong(track.pipedId);
                        if (song && song.thumbnails && song.thumbnails.length > 0) {
                            const newThumbnail = song.thumbnails[song.thumbnails.length - 1].url;
                            await fastify.prisma.track.update({ where: { id }, data: { thumbnailUrl: newThumbnail } });
                            enrichedThumbnails.set(id, newThumbnail);
                        }
                    } catch (err) { }
                }));
            }

            const getThumbnail = (track: any) => enrichedThumbnails.get(track.id) || track.thumbnailUrl || '';
            const mapEnrichedTrack = (track: any) => ({
                url: `/api/music/streams/${track.pipedId}`,
                title: track.title,
                thumbnail: getThumbnail(track),
                uploaderName: track.artist || 'Unknown Artist',
                duration: track.duration,
                pipedId: track.pipedId,
                id: track.pipedId,
                artistId: track.artistRel?.pipedId,
                type: 'song'
            });

            // --- ASSEMBLE SHELVES ---
            const shelves = [];

            if (quickPicksItems.length > 0) {
                if (topStats.length > 0) quickPicksItems = topStats.map(s => mapEnrichedTrack(s.track));
                shelves.push({ title: "Quick Picks", items: quickPicksItems });
            }

            if (history.length > 0) {
                shelves.push({ title: "Listen Again", items: history.map(h => mapEnrichedTrack(h.track)) });
            }

            if (trendingItems.length > 0) {
                shelves.push({ title: trendingSection ? trendingSection.title : `Trending in ${region}`, items: trendingItems });
            }

            if (newReleasesItems.length > 0) {
                shelves.push({ title: "New Releases", items: newReleasesItems });
            }

            // Add other sections from Home Sections (e.g. "Moods", "Playlists")
            // Filter out sections we already used or don't want
            const otherSections = homeSections.filter(s =>
                !/trending|top music videos|charts|new releases/i.test(s.title) &&
                s.contents?.length > 0
            ).slice(0, 5); // Take top 5 other sections

            otherSections.forEach(section => {
                const items = section.contents.map((item: any) => {
                    const id = item.browseId || item.albumId || item.playlistId;
                    if ((item.type === 'PLAYLIST' || item.type === 'ALBUM') && id) {
                        return {
                            id: id,
                            title: item.title || item.name,
                            thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || '',
                            uploaderName: item.subtitle || item.artist?.name || 'YouTube Music',
                            type: item.type.toLowerCase(),
                            url: `/library/playlist/${id}`
                        };
                    } else if (item.videoId) {
                        return mapApiItem(item);
                    }
                    return null;
                }).filter(Boolean);

                if (items.length > 0) {
                    shelves.push({ title: section.title, items });
                }
            });

            return shelves;

        } catch (error) {
            console.error("Home aggregation error:", error);
            reply.status(500).send({ error: "Failed to fetch home data" });
        }
    });
}
