import { FastifyPluginAsync } from 'fastify';
import { ytmusic } from '../services/ytmusic';

const artistRoutes: FastifyPluginAsync = async (server) => {

    // Get Artist Details
    server.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        try {
            // Try DB first
            let artist = null;
            if (isUuid) {
                artist = await server.prisma.artist.findFirst({ where: { id } });
            } else {
                artist = await server.prisma.artist.findFirst({ where: { pipedId: id } });
            }

            const pipedId = artist?.pipedId || id;

            // Fetch fresh data from YTMusic
            const ytArtist: any = await ytmusic.getArtist(pipedId);

            // Upsert into DB
            artist = await server.prisma.artist.upsert({
                where: { pipedId: pipedId },
                update: {
                    name: ytArtist.name,
                    thumbnailUrl: ytArtist.thumbnails?.[ytArtist.thumbnails.length - 1]?.url,
                    updatedAt: new Date()
                },
                create: {
                    pipedId: pipedId,
                    name: ytArtist.name,
                    thumbnailUrl: ytArtist.thumbnails?.[ytArtist.thumbnails.length - 1]?.url,
                }
            });

            // Filter similarArtists to exclude playlists (IDs starting with VL or PL)
            const filteredSimilarArtists = (ytArtist.similarArtists || []).filter((s: any) =>
                s.artistId &&
                !s.artistId.startsWith('VL') &&
                !s.artistId.startsWith('PL') &&
                s.artistId.startsWith('UC') // Only valid channel/artist IDs
            );

            return {
                ...artist,
                ...ytArtist,
                similarArtists: filteredSimilarArtists
            };
        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch artist' });
        }
    });

    // Get Artist Albums
    // IMPORTANT: We use albums from getArtist() (topAlbums) NOT getArtistAlbums()
    // because getArtistAlbums returns polluted data with misattributed content
    server.get('/:id/albums', async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            const artist: any = await ytmusic.getArtist(id);
            const artistName = artist.name.toLowerCase();

            // Combine topAlbums and topSingles as official releases
            const allReleases = [...(artist.topAlbums || []), ...(artist.topSingles || [])];

            // Strict validation: 
            // 1. Album must have valid albumId
            // 2. Artist name must match (not "Podcasts", "Various Artists" etc.)
            // 3. Exclude playlists (albumId starting with VL)
            const validAlbums = allReleases.filter((a: any) => {
                if (!a.albumId) return false;
                if (a.albumId.startsWith('VL')) return false; // Playlist, not album
                if (!a.artist) return true; // If no artist field, trust it's from the artist page

                const aName = a.artist.name?.toLowerCase() || '';
                // Reject if artist name is clearly wrong
                if (aName === 'podcasts' || aName === 'various artists') return false;
                // Accept if name matches
                return aName.includes(artistName) || artistName.includes(aName) || a.artist.artistId === id;
            }).map((a: any) => ({
                ...a,
                browseId: a.albumId,
                year: a.year || null
            }));

            return { albums: validAlbums };
        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch albums' });
        }
    });

    // Get Artist Songs (Full Catalog)
    // Strategy: Deep Scan
    // 1. Fetch getArtistSongs (polluted but extensive)
    // 2. Fetch getArtist (trusted topAlbums/topSingles)
    // 3. Extract all albumIds
    // 4. Fetch ALL albums to verify authorship and get full tracklists
    // 5. Filter and deduplicate
    server.get('/:id/songs', async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            const [artist, rawSongs] = await Promise.all([
                ytmusic.getArtist(id),
                ytmusic.getArtistSongs(id)
            ]);

            const artistName = (artist as any).name.toLowerCase();
            const trustedAlbumIds = new Set<string>();

            // Add trusted albums/singles
            [...((artist as any).topAlbums || []), ...((artist as any).topSingles || [])].forEach((a: any) => {
                if (a.albumId) trustedAlbumIds.add(a.albumId);
            });

            // Collect all unique album IDs to fetch
            const albumsToFetch = new Set<string>(trustedAlbumIds);
            (rawSongs as any[]).forEach((s: any) => {
                if (s.album?.id) albumsToFetch.add(s.album.id);
                if (s.album?.albumId) albumsToFetch.add(s.album.albumId);
            });

            // Fetch all albums in chunks to avoid rate limits/timeouts
            const albumIds = Array.from(albumsToFetch);
            const chunkSize = 20;
            const albumResults: any[] = [];

            for (let i = 0; i < albumIds.length; i += chunkSize) {
                const chunk = albumIds.slice(i, i + chunkSize);
                const chunkResults = await Promise.all(
                    chunk.map(async (albumId) => {
                        try {
                            return await ytmusic.getAlbum(albumId);
                        } catch (e) {
                            return null;
                        }
                    })
                );
                albumResults.push(...chunkResults);
            }

            const allSongs: any[] = [];
            const seenVideoIds = new Set<string>();

            for (const album of albumResults) {
                if (!album) continue;

                const albumArtistName = album.artist?.name?.toLowerCase() || '';
                const isTrustedAlbum = album.artist?.artistId === id ||
                    albumArtistName.includes(artistName) ||
                    artistName.includes(albumArtistName);

                const isVariousArtists = albumArtistName === 'various artists';

                // If album is NOT trusted and NOT various artists, it's likely pollution (e.g. Shyam Kuteliha)
                // UNLESS the artist is explicitly listed on the tracks
                if (!isTrustedAlbum && !isVariousArtists) {
                    // Check if ANY track on the album belongs to the artist
                    // If so, we might treat it as a "feat" or "compilation"
                    // But user said "belongs to THAT ARTIST only".
                    // So we only include tracks that explicitly match.
                }

                const albumYear = album.year || null;

                for (const song of (album.songs || [])) {
                    if (!song.videoId || seenVideoIds.has(song.videoId)) continue;

                    // Verification Logic
                    let isMatch = false;

                    // 1. If Album is Trusted, assume all songs are good (unless it's a compilation/various)
                    if (isTrustedAlbum && !isVariousArtists) {
                        isMatch = true;
                    }
                    // 2. If Various Artists or Untrusted Album, check Song Artist AND Title
                    else {
                        const songArtistName = song.artist?.name?.toLowerCase() || '';
                        // song.artists might not exist on Album Song type, so cast to any or use artist
                        const songArtists = (song as any).artists || [];
                        const songName = song.name.toLowerCase();

                        const nameMatch = songArtistName.includes(artistName) || artistName.includes(songArtistName);
                        const idMatch = song.artist?.artistId === id;
                        const arrayMatch = songArtists.some((a: any) => a.artistId === id || a.name?.toLowerCase().includes(artistName));
                        // Also check if title contains "feat. Artist" or just "Artist" if it's a collab context
                        // But be careful not to match "Old Skool" with "Old"
                        const titleMatch = songName.includes(artistName);

                        if (nameMatch || idMatch || arrayMatch || titleMatch) {
                            isMatch = true;
                        }
                    }

                    if (isMatch) {
                        seenVideoIds.add(song.videoId);
                        allSongs.push({
                            ...song,
                            artists: (song as any).artists || (song.artist ? [song.artist] : [{ name: (artist as any).name, artistId: id }]),
                            album: {
                                name: album.name,
                                id: album.albumId,
                                year: albumYear
                            },
                            year: albumYear,
                            duration: song.duration || null
                        });
                    }
                }
            }

            return { songs: allSongs };
        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch songs' });
        }
    });
};

export default artistRoutes;

