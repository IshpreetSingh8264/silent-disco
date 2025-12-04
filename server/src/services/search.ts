import { prisma } from '../db';
import { ytmusic } from './ytmusic';
import { SearchItem, SearchSuggestion, SearchResult } from '../types/search';

export class SearchService {

    /**
     * Typeahead / Suggestions
     * Optimized for speed (<120ms).
     * 1. DB Exact/Prefix Match
     * 2. DB Fuzzy Match (using contains for now, pg_trgm later)
     * 3. YT Fallback (only if local results are scarce)
     */
    async suggest(query: string, userId?: string): Promise<SearchSuggestion[]> {
        const normalizedQuery = query.trim();
        if (normalizedQuery.length < 1) return [];

        // 1. Parallel DB Queries
        // We use 'contains' which maps to ILIKE in Postgres (case insensitive)
        const [dbArtists, dbTracks] = await Promise.all([
            prisma.artist.findMany({
                where: {
                    name: { contains: normalizedQuery, mode: 'insensitive' }
                },
                take: 5,
                orderBy: { monthlyListeners: 'desc' }
            }),
            prisma.track.findMany({
                where: {
                    title: { contains: normalizedQuery, mode: 'insensitive' }
                },
                take: 5,
                include: { artistRel: true },
                orderBy: { globalPlayCount: 'desc' }
            })
        ]);

        // 2. Score & Rank Local Results
        const localItems: SearchItem[] = [];

        // Artists
        dbArtists.forEach(a => {
            localItems.push({
                type: 'artist',
                id: a.id,
                pipedId: a.pipedId,
                title: a.name,
                subtitle: 'Artist',
                thumbnail: a.thumbnailUrl || undefined,
                score: this.calculateScore(a.name, normalizedQuery, 1000), // Base score for artists
                action: 'navigate'
            });
        });

        // Tracks
        dbTracks.forEach(t => {
            localItems.push({
                type: 'track',
                id: t.id,
                pipedId: t.pipedId,
                title: t.title,
                subtitle: t.artistRel?.name || t.artist,
                thumbnail: t.thumbnailUrl || undefined,
                score: this.calculateScore(t.title, normalizedQuery, 500), // Base score for tracks
                action: 'play',
                data: t
            });
        });

        // 3. YT Fallback (if needed)
        // If we have fewer than 5 results, fetch from YT
        if (localItems.length < 5) {
            try {
                const ytResults = await ytmusic.search(normalizedQuery);
                const ytItems = this.normalizeYTResults(ytResults);

                // Deduplicate: Don't add if we already have it from DB
                ytItems.forEach(ytItem => {
                    const exists = localItems.some(l => l.pipedId === ytItem.pipedId || l.title.toLowerCase() === ytItem.title.toLowerCase());
                    if (!exists) {
                        localItems.push(ytItem);
                    }
                });
            } catch (e) {
                console.error('YT Search failed:', e);
            }
        }

        // 4. Sort by Score
        localItems.sort((a, b) => (b.score || 0) - (a.score || 0));

        // 5. Group into Sections
        const topResult = localItems[0];
        const others = localItems.slice(1);

        const suggestions: SearchSuggestion[] = [];

        if (topResult) {
            suggestions.push({
                section: 'Top Result',
                items: [topResult]
            });
        }

        const tracks = others.filter(i => i.type === 'track').slice(0, 4);
        const artists = others.filter(i => i.type === 'artist').slice(0, 4);

        if (tracks.length > 0) suggestions.push({ section: 'Songs', items: tracks });
        if (artists.length > 0) suggestions.push({ section: 'Artists', items: artists });

        return suggestions;
    }

    /**
     * Full Search
     * Comprehensive results from all sources (DB + YT).
     */
    async search(query: string): Promise<SearchResult> {
        const normalizedQuery = query.trim();

        // 1. Parallel Queries: DB (Artists, Tracks) + YT
        const [dbArtists, dbTracks, ytResults] = await Promise.all([
            prisma.artist.findMany({
                where: { name: { contains: normalizedQuery, mode: 'insensitive' } },
                take: 5,
                orderBy: { monthlyListeners: 'desc' }
            }),
            prisma.track.findMany({
                where: { title: { contains: normalizedQuery, mode: 'insensitive' } },
                take: 10,
                include: { artistRel: true },
                orderBy: { globalPlayCount: 'desc' }
            }),
            ytmusic.search(normalizedQuery).catch((e: any) => {
                console.error('YT Search failed:', e);
                return [];
            })
        ]);

        // 2. Normalize DB Results
        const localArtists: SearchItem[] = dbArtists.map((a: any) => ({
            type: 'artist',
            id: a.id,
            pipedId: a.pipedId,
            title: a.name,
            subtitle: 'Artist',
            thumbnail: a.thumbnailUrl || undefined,
            score: 1000,
            action: 'navigate'
        }));

        const localTracks: SearchItem[] = dbTracks.map((t: any) => ({
            type: 'track',
            id: t.id,
            pipedId: t.pipedId,
            title: t.title,
            subtitle: t.artistRel?.name || t.artist,
            thumbnail: t.thumbnailUrl || undefined,
            score: 500,
            action: 'play',
            data: t
        }));

        const localAlbums: SearchItem[] = []; // No local Album model yet

        // 3. Normalize YT Results
        const ytItems = this.normalizeYTResults(ytResults);

        // 4. Merge & Deduplicate
        // Helper to merge lists, preferring Local over YT if IDs match
        const merge = (local: SearchItem[], remote: SearchItem[]) => {
            const combined = [...local];
            const localIds = new Set(local.map(i => i.pipedId).filter(Boolean));
            const localTitles = new Set(local.map(i => i.title.toLowerCase()));

            remote.forEach(item => {
                // Check for duplicate by ID or exact Title match (for artists)
                const isDuplicateId = item.pipedId && localIds.has(item.pipedId);
                const isDuplicateTitle = item.type === 'artist' && localTitles.has(item.title.toLowerCase());

                if (!isDuplicateId && !isDuplicateTitle) {
                    combined.push(item);
                }
            });
            return combined;
        };


        const mergedArtists = merge(localArtists, ytItems.filter(i => i.type === 'artist'));
        const mergedTracks = merge(localTracks, ytItems.filter(i => i.type === 'track'));
        const mergedAlbums = merge(localAlbums, ytItems.filter(i => i.type === 'album'));
        const mergedPlaylists = ytItems.filter(i => i.type === 'playlist'); // We don't have local playlists in search yet

        return {
            tracks: mergedTracks,
            artists: mergedArtists,
            albums: mergedAlbums,
            playlists: mergedPlaylists
        };
    }

    private calculateScore(text: string, query: string, base: number): number {
        const t = text.toLowerCase();
        const q = query.toLowerCase();

        if (t === q) return base + 100; // Exact match
        if (t.startsWith(q)) return base + 50; // Prefix match
        if (t.includes(q)) return base + 10; // Contains
        return base;
    }

    private normalizeYTResults(results: any[]): SearchItem[] {
        return results.map(item => {
            let type: SearchItem['type'] = 'track';
            if (item.type === 'ARTIST') type = 'artist';
            if (item.type === 'ALBUM') type = 'album';
            if (item.type === 'PLAYLIST') type = 'playlist';

            return {
                type,
                id: item.videoId || item.browseId || item.playlistId, // Use YT ID as ID for now
                pipedId: item.videoId || item.browseId || item.playlistId,
                title: item.name,
                subtitle: item.artist?.name || item.artists?.[0]?.name,
                thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url,
                score: 100, // Default score for YT items
                action: type === 'track' ? 'play' : 'navigate',
                data: item
            };
        });
    }
}

export const searchService = new SearchService();

