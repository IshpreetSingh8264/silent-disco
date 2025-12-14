import { API_BASE_URL } from '../config/api';

// Cache stream URLs to avoid refetching (URLs expire after ~6 hours typically)
const streamUrlCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

/**
 * Fetches the direct stream URL for a video ID.
 * The returned URL points directly to YouTube's CDN, loading on user's internet.
 */
export async function getStreamUrl(videoId: string): Promise<string> {
    if (!videoId || videoId === 'undefined') {
        throw new Error('Invalid video ID');
    }

    // Check cache first
    const cached = streamUrlCache.get(videoId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[StreamService] Cache hit for ${videoId}`);
        return cached.url;
    }

    console.log(`[StreamService] Fetching stream URL for ${videoId}`);

    const response = await fetch(`${API_BASE_URL}/api/music/streams/${videoId}`);

    if (!response.ok) {
        throw new Error(`Failed to get stream URL: ${response.status}`);
    }

    const data = await response.json();

    if (!data.url) {
        throw new Error('No stream URL returned');
    }

    console.log(`[StreamService] Got URL from ${data.source} for ${videoId}`);

    // Cache the URL
    streamUrlCache.set(videoId, { url: data.url, timestamp: Date.now() });

    return data.url;
}

/**
 * Preload stream URL for a track (call this ahead of time for smoother UX)
 */
export function preloadStreamUrl(videoId: string): void {
    if (!videoId || streamUrlCache.has(videoId)) return;

    // Fire and forget - preload in background
    getStreamUrl(videoId).catch(() => {
        // Ignore errors for preload
    });
}

/**
 * Clear expired cache entries
 */
export function cleanStreamCache(): void {
    const now = Date.now();
    for (const [key, value] of streamUrlCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            streamUrlCache.delete(key);
        }
    }
}

// Clean cache periodically
setInterval(cleanStreamCache, 30 * 60 * 1000); // Every 30 minutes
