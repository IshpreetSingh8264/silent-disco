import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ytmusic } from '../services/ytmusic';
const publicPlaylistRoutes: FastifyPluginAsync = async (server) => {

    // List Public Playlists
    server.get('/', async (request, reply) => {
        try {
            const playlists = await server.prisma.playlist.findMany({
                where: {
                    OR: [
                        { isPublic: true },
                        { isSystem: true }
                    ]
                },
                orderBy: { playCount: 'desc' },
                take: 50,
                include: {
                    _count: {
                        select: { tracks: true }
                    }
                }
            });
            return playlists;
        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch public playlists' });
        }
    });

    // Get Public Playlist Details
    server.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            // If it's an external ID (VL/PL), try fetching from YTMusic
            // If it's NOT a UUID (likely an external ID like VL, PL, RD, etc.), try fetching from YTMusic
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

            if (!isUuid) {
                try {
                    // Check for Album IDs (MPREb...)
                    // Note: OLAK5uy IDs are handled by ytpl below as getAlbum fails for them
                    const isAlbum = id.startsWith('MPREb');

                    if (isAlbum) {
                        const album: any = await ytmusic.getAlbum(id);
                        if (!album) throw new Error('Album not found');

                        return {
                            id: album.albumId || id,
                            name: album.name || album.title,
                            isPublic: true,
                            isSystem: false,
                            thumbnailUrl: album.thumbnails?.[album.thumbnails.length - 1]?.url,
                            playCount: 0,
                            tracks: (album.songs || []).map((item: any, index: number) => ({
                                order: index,
                                track: {
                                    id: item.videoId,
                                    pipedId: item.videoId,
                                    title: item.name || item.title,
                                    artist: item.artists?.[0]?.name || album.artist?.name || 'Unknown',
                                    artistId: item.artists?.[0]?.id || album.artist?.artistId,
                                    thumbnailUrl: item.thumbnails?.[0]?.url || album.thumbnails?.[0]?.url, // Fallback to album art
                                    duration: item.duration || 0
                                }
                            }))
                        };
                    }

                    // Use ytpl for OL (Albums) and RD (Mixes) as ytmusic-api fails for them
                    // Also use it as fallback for PL if needed
                    const isMixOrAlbum = id.startsWith('OL') || id.startsWith('RD');

                    if (isMixOrAlbum) {
                        const ytpl = require('ytpl');
                        const playlist = await ytpl(id, { limit: Infinity });
                        return {
                            id: playlist.id,
                            name: playlist.title,
                            isPublic: true,
                            isSystem: false,
                            thumbnailUrl: playlist.bestThumbnail.url,
                            playCount: 0,
                            tracks: playlist.items.map((item: any, index: number) => ({
                                order: index,
                                track: {
                                    id: item.id,
                                    pipedId: item.id,
                                    title: item.title,
                                    artist: item.author?.name || 'Unknown',
                                    artistId: item.author?.channelID,
                                    thumbnailUrl: item.bestThumbnail.url,
                                    duration: item.durationSec || 0
                                }
                            }))
                        };
                    }

                    const playlist: any = await ytmusic.getPlaylist(id);

                    // Check if tracks are empty (common issue with ytmusic-api for PL playlists)
                    if (!playlist.items || playlist.items.length === 0) {
                        // Try ytpl as fallback
                        const ytpl = require('ytpl');
                        const ytplPlaylist = await ytpl(id, { limit: Infinity });
                        return {
                            id: ytplPlaylist.id,
                            name: ytplPlaylist.title,
                            isPublic: true,
                            isSystem: false,
                            thumbnailUrl: ytplPlaylist.bestThumbnail.url,
                            playCount: 0,
                            tracks: ytplPlaylist.items.map((item: any, index: number) => ({
                                order: index,
                                track: {
                                    id: item.id,
                                    pipedId: item.id,
                                    title: item.title,
                                    artist: item.author?.name || 'Unknown',
                                    artistId: item.author?.channelID,
                                    thumbnailUrl: item.bestThumbnail.url,
                                    duration: item.durationSec || 0
                                }
                            }))
                        };
                    }

                    // Map to our format
                    return {
                        id: playlist.playlistId || playlist.id,
                        name: playlist.name || playlist.title,
                        isPublic: true,
                        isSystem: false,
                        thumbnailUrl: playlist.thumbnails?.[0]?.url || playlist.thumbnail,
                        playCount: 0,
                        tracks: (playlist.items || []).map((item: any, index: number) => ({
                            order: index,
                            track: {
                                id: item.videoId || item.id,
                                pipedId: item.videoId || item.id,
                                title: item.name || item.title,
                                artist: item.artists?.[0]?.name || item.author?.name || 'Unknown',
                                artistId: item.artists?.[0]?.id || item.author?.id, // Ensure artistId is passed
                                thumbnailUrl: item.thumbnails?.[0]?.url || item.thumbnail,
                                duration: item.duration?.totalSeconds || item.duration || 0
                            }
                        }))
                    };
                } catch (e) {
                    server.log.warn(`Failed to fetch playlist ${id} from YTMusic/ytpl: ${e}`);
                    // Fallback to DB check below (in case we have a legacy non-UUID ID in DB?)
                }
            }


            const playlist = await server.prisma.playlist.findFirst({
                where: {
                    id,
                    OR: [
                        { isPublic: true },
                        { isSystem: true }
                    ]
                },
                include: {
                    tracks: {
                        include: {
                            track: { include: { artistRel: true } }
                        },
                        orderBy: { order: 'asc' }
                    }
                }
            });

            if (!playlist) {
                return reply.status(404).send({ error: 'Playlist not found' });
            }

            // Increment play count (async)
            server.prisma.playlist.update({
                where: { id },
                data: { playCount: { increment: 1 } }
            }).catch(console.error);

            return playlist;
        } catch (error) {
            server.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch playlist details' });
        }
    });
};

export default publicPlaylistRoutes;
