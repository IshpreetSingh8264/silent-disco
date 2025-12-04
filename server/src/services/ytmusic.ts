import YTMusic from 'ytmusic-api';

class YTMusicService {
    private api: YTMusic;
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
}

export const ytmusic = new YTMusicService();
