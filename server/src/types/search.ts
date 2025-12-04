export interface SearchSuggestion {
    section: string; // "Top Result", "Songs", "Artists", "Albums"
    items: SearchItem[];
}

export interface SearchItem {
    type: 'track' | 'artist' | 'album' | 'playlist';
    id: string; // Canonical ID (UUID) or PipedID if not in DB
    pipedId?: string;
    title: string;
    subtitle?: string; // e.g. "Artist • Album"
    thumbnail?: string;
    score?: number; // Relevance score
    action?: 'play' | 'navigate';
    data?: any; // Extra data (e.g. full track object for playback)
}

export interface SearchResult {
    tracks: SearchItem[];
    artists: SearchItem[];
    albums: SearchItem[];
    playlists: SearchItem[];
}

export interface SearchQuery {
    q: string;
    types?: string[]; // ['track', 'artist']
    limit?: number;
    userId?: string;
}
