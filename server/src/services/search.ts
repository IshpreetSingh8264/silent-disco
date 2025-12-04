import { Track } from '@prisma/client';

const MEILI_HOST = process.env.MEILI_HOST || 'http://localhost:7700';
const MEILI_KEY = process.env.MEILI_MASTER_KEY || 'masterKey123';

import YTMusic from 'ytmusic-api';

// ... (existing imports)

export class SearchService {
    private ytmusic: YTMusic;

    constructor() {
        this.ytmusic = new YTMusic();
        this.ytmusic.initialize().catch(console.error);
    }

    private async request(path: string, method: string, body?: any): Promise<any> {
        const res = await fetch(`${MEILI_HOST}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MEILI_KEY}`
            },
            body: body ? JSON.stringify(body) : undefined
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Meilisearch error: ${err}`);
        }
        return res.json();
    }

    // ... (existing request/initialize/indexTracks methods)

    async search(query: string, limit = 10) {
        let hits: any[] = [];

        // 1. Try Meilisearch (Local Library)
        try {
            const res = await this.request('/indexes/tracks/search', 'POST', {
                q: query,
                limit: 5, // Get top 5 local
                attributesToHighlight: ['title', 'artist']
            });
            hits = res.hits.map((h: any) => ({
                ...h,
                source: 'LOCAL'
            }));
        } catch (e) {
            console.warn('Meilisearch unavailable:', e);
        }

        // 2. Fallback/Augment with YouTube Music (Global)
        // Only if we have few results or want to mix
        if (hits.length < limit) {
            try {
                const ytResults = await this.ytmusic.search(query);
                const validYt = ytResults
                    .filter((item: any) => item.videoId)
                    .map((item: any) => ({
                        id: item.videoId, // Use videoId as ID
                        pipedId: item.videoId,
                        title: item.name,
                        artist: item.artist?.name || 'Unknown Artist',
                        thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url,
                        source: 'YOUTUBE'
                    }))
                    .slice(0, limit - hits.length);

                hits = [...hits, ...validYt];
            } catch (e) {
                console.warn('YTMusic search failed:', e);
            }
        }

        return hits;
    }
}

export const searchService = new SearchService();
