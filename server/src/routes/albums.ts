import { FastifyPluginAsync } from 'fastify';
import { ytmusic } from '../services/ytmusic';

const albumRoutes: FastifyPluginAsync = async (server) => {

    // Get Album Details with Tracks
    server.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            const album = await ytmusic.getAlbum(id);

            // Map tracks to the format expected by the frontend
            const tracks = (album.songs || []).map((song: any) => ({
                id: song.videoId,
                pipedId: song.videoId,
                title: song.name,
                uploaderName: song.artist?.name || album.artist?.name || 'Unknown',
                thumbnail: song.thumbnails?.[song.thumbnails.length - 1]?.url || album.thumbnails?.[0]?.url,
                thumbnailUrl: song.thumbnails?.[song.thumbnails.length - 1]?.url || album.thumbnails?.[0]?.url,
                duration: song.duration || 0,
                album: album.name
            }));

            return {
                id: album.albumId,
                name: album.name,
                artist: album.artist,
                year: album.year,
                thumbnails: album.thumbnails,
                tracks
            };
        } catch (error) {
            server.log.error(error);
            return reply.status(404).send({ error: 'Album not found' });
        }
    });
};

export default albumRoutes;
