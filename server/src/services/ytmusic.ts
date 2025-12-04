import YTMusic from 'ytmusic-api';

class YTMusicService {
    public api: YTMusic;
    private initialized: boolean = false;

    constructor() {
        this.api = new YTMusic();
    }

    async initialize() {
        if (!this.initialized) {
            await this.api.initialize();
            this.initialized = true;
        }
    }

    async getSong(videoId: string) {
        await this.initialize();
        return this.api.getSong(videoId);
    }

    async search(query: string) {
        await this.initialize();
        return this.api.search(query);
    }

    async getUpNexts(videoId: string) {
        await this.initialize();
        return this.api.getUpNexts(videoId);
    }

    async getArtist(artistId: string) {
        await this.initialize();
        return this.api.getArtist(artistId);
    }

    async getPlaylist(playlistId: string) {
        await this.initialize();
        return this.api.getPlaylist(playlistId);
    }

    async getAlbum(albumId: string) {
        await this.initialize();
        return this.api.getAlbum(albumId);
    }

    async getArtistSongs(artistId: string) {
        await this.initialize();
        return this.api.getArtistSongs(artistId);
    }

    async getArtistAlbums(artistId: string) {
        await this.initialize();
        return this.api.getArtistAlbums(artistId);
    }
}

export const ytmusic = new YTMusicService();
