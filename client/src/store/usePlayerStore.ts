import { create } from 'zustand';
import { analytics } from '../services/analytics';

export interface Track {
    id?: string;
    pipedId?: string;
    url: string;
    title: string;
    thumbnail: string;
    uploaderName: string;
    duration: number;
    artist?: string;
    album?: string;
    thumbnailUrl?: string;
    thumbnailHdUrl?: string;
    isPlayed?: boolean;
    isManual?: boolean;
    queueId?: string;
    artistId?: string;
    type?: 'song' | 'video';
}

interface PlayerState {
    currentTrack: Track | null;
    isPlaying: boolean;

    // 3-Layer Queue System
    queueExplicit: Track[]; // User added (Highest Priority)
    queueSystem: Track[];   // Playlist/Album context (Medium Priority)
    queueAI: Track[];       // Recommendations (Low Priority)

    // Computed getter for UI
    getQueue: () => Track[];

    history: Track[];
    isShuffle: boolean;
    playbackContext: string;
    startTime: number | null;

    checkSmartQueue: () => Promise<void>;
    fetchQueue: () => Promise<void>;
    playNext: () => void;
    playPrevious: () => void;
    playTrack: (track: Track, context?: string) => void;
    playTrackFromQueue: (trackId: string) => void;
    playPlaylist: (tracks: Track[], startIndex?: number, context?: string) => void;
    togglePlay: () => void;
    setPlaying: (isPlaying: boolean) => void;
    addToQueue: (track: Track) => Promise<void>;
    removeFromQueue: (queueId: string) => Promise<void>;
    clearQueue: () => void;
    toggleShuffle: () => void;
    addToHistory: (track: Track, context: string) => Promise<void>;
    sendSignal: (trackId: string, type: string, value?: number, metadata?: any) => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
    // ... (state remains same)
    currentTrack: null,
    isPlaying: false,
    queueExplicit: [],
    queueSystem: [],
    queueAI: [],
    history: [],
    isShuffle: false,
    playbackContext: 'radio',
    startTime: null,

    getQueue: () => {
        const { queueExplicit, queueSystem, queueAI } = get();
        return [...queueExplicit, ...queueSystem, ...queueAI];
    },

    fetchQueue: async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await fetch('/api/queue', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const queue = await res.json();
                // Separate into explicit/system/ai if needed, or just put all in explicit for now
                // Ideally backend returns source.
                const explicit = queue.filter((t: any) => t.isManual);
                const system = queue.filter((t: any) => !t.isManual); // Assuming others are system/ai

                set({
                    queueExplicit: explicit,
                    queueSystem: system // or handle AI separately
                });
            }
        } catch (e) {
            console.error('Failed to fetch queue', e);
        }
    },

    // ... (playTrack etc remain same, they call sendSignal/addToHistory)

    // ... (playTrack etc remain same, they call sendSignal/addToHistory)

    playTrack: (track, context = 'search') => {
        const { currentTrack, history, addToHistory, startTime, sendSignal } = get();

        // Record signals for previous track
        if (currentTrack && startTime) {
            const dwellTime = (Date.now() - startTime) / 1000;
            sendSignal(currentTrack.pipedId || currentTrack.id || '', 'DWELL', dwellTime);
            if (dwellTime < 30) sendSignal(currentTrack.pipedId || currentTrack.id || '', 'SKIP', dwellTime);
            set({ history: [currentTrack, ...history] });
        }

        // Ensure URL exists
        const trackWithUrl = {
            ...track,
            url: track.url || `/api/music/streams/${track.pipedId || track.id}`
        };

        set({
            currentTrack: trackWithUrl,
            isPlaying: true,
            playbackContext: context,
            queueSystem: [],
            queueAI: [],
            queueExplicit: [],
            startTime: Date.now()
        });
        addToHistory(trackWithUrl, context);
        get().checkSmartQueue();
    },

    playPlaylist: (tracks: Track[], startIndex = 0, context = 'playlist') => {
        if (tracks.length === 0) return;
        const { currentTrack, history, addToHistory, startTime, sendSignal } = get();

        if (currentTrack && startTime) {
            const dwellTime = (Date.now() - startTime) / 1000;
            sendSignal(currentTrack.pipedId || currentTrack.id || '', 'DWELL', dwellTime);
            set({ history: [currentTrack, ...history] });
        }

        // Ensure URLs for all tracks in playlist
        const tracksWithUrls = tracks.map(t => ({
            ...t,
            url: t.url || `/api/music/streams/${t.pipedId || t.id}`
        }));

        const firstTrack = tracksWithUrls[startIndex];
        const remainingTracks = tracksWithUrls.slice(startIndex + 1);

        set({
            currentTrack: firstTrack,
            queueSystem: remainingTracks,
            queueExplicit: [],
            queueAI: [],
            isPlaying: true,
            isShuffle: false,
            playbackContext: context,
            startTime: Date.now()
        });
        addToHistory(firstTrack, context);
        get().checkSmartQueue();
    },

    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
    setPlaying: (isPlaying: boolean) => set({ isPlaying }),

    addToQueue: async (track) => {
        // Ensure URL
        const trackWithUrl = {
            ...track,
            url: track.url || `/api/music/streams/${track.pipedId || track.id}`
        };

        // Optimistic update
        const tempId = Math.random().toString(36).substring(7);
        const optimisticTrack = { ...trackWithUrl, isManual: true, queueId: tempId };

        set((state) => ({
            queueExplicit: [...state.queueExplicit, optimisticTrack]
        }));

        try {
            const token = localStorage.getItem('token');
            if (token) {
                const res = await fetch('/api/queue', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ track: trackWithUrl, source: 'MANUAL' })
                });
                if (res.ok) {
                    const savedTrack = await res.json();
                    // Replace optimistic track with real one (ensure URL is preserved if backend doesn't send it back fully)
                    set((state) => ({
                        queueExplicit: state.queueExplicit.map(t => t.queueId === tempId ? { ...savedTrack, url: savedTrack.url || trackWithUrl.url } : t)
                    }));
                }
            }
        } catch (e) {
            console.error('Failed to sync queue add', e);
        }
    },

    removeFromQueue: async (queueId: string) => {
        // Optimistic update
        set((state) => ({
            queueExplicit: state.queueExplicit.filter(t => t.queueId !== queueId && t.id !== queueId),
            queueSystem: state.queueSystem.filter(t => t.queueId !== queueId && t.id !== queueId),
            queueAI: state.queueAI.filter(t => t.queueId !== queueId && t.id !== queueId)
        }));

        try {
            const token = localStorage.getItem('token');
            if (token) {
                await fetch(`/api/queue/${queueId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
        } catch (e) {
            console.error('Failed to sync queue remove', e);
        }
    },

    clearQueue: () => set({ queueExplicit: [], queueSystem: [], queueAI: [] }),

    toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),

    playNext: () => {
        const { queueExplicit, queueSystem, queueAI, currentTrack, addToHistory, playbackContext, startTime, sendSignal } = get();

        if (currentTrack && startTime) {
            const dwellTime = (Date.now() - startTime) / 1000;
            sendSignal(currentTrack.pipedId || currentTrack.id || '', 'DWELL', dwellTime);
            set({ history: [currentTrack, ...get().history] });
        }

        let nextTrack: Track | undefined;
        let sourceQueue: 'explicit' | 'system' | 'ai' = 'ai';

        if (queueExplicit.length > 0) {
            nextTrack = queueExplicit[0];
            sourceQueue = 'explicit';
        } else if (queueSystem.length > 0) {
            nextTrack = queueSystem[0];
            sourceQueue = 'system';
        } else if (queueAI.length > 0) {
            nextTrack = queueAI[0];
            sourceQueue = 'ai';
        }

        if (nextTrack) {
            set({
                currentTrack: nextTrack,
                isPlaying: true,
                startTime: Date.now(),
                queueExplicit: sourceQueue === 'explicit' ? queueExplicit.slice(1) : queueExplicit,
                queueSystem: sourceQueue === 'system' ? queueSystem.slice(1) : queueSystem,
                queueAI: sourceQueue === 'ai' ? queueAI.slice(1) : queueAI
            });
            addToHistory(nextTrack, playbackContext);
            get().checkSmartQueue();
        } else {
            set({ isPlaying: false });
        }
    },

    playPrevious: () => {
        const { history } = get();
        if (history.length > 0) {
            const previousTrack = history[0];
            const newHistory = history.slice(1);
            set({
                currentTrack: previousTrack,
                history: newHistory,
                isPlaying: true,
                startTime: Date.now()
            });
        }
    },

    addToHistory: async (track: Track, context: string) => {
        analytics.track('PLAYED', {
            trackId: track.pipedId || track.id,
            metadata: { context },
            value: track.duration || 0,
            trackDetails: {
                title: track.title,
                artist: track.artist || track.uploaderName || 'Unknown Artist',
                thumbnailUrl: track.thumbnailUrl || track.thumbnail,
                duration: track.duration || 0
            }
        });
    },

    sendSignal: async (trackId: string, type: string, value?: number, metadata?: any) => {
        // We might need trackDetails here too if signal comes before PLAYED, but usually PLAYED is first or concurrent.
        // For now, let's assume PLAYED handles creation.
        analytics.track(type, { trackId, value, metadata });
    },

    playTrackFromQueue: (trackId: string) => {
        const { queueExplicit, queueSystem, queueAI, currentTrack, addToHistory, playbackContext, startTime, sendSignal } = get();

        // 1. Calculate skipped tracks and find target
        let skipped: Track[] = [];
        let foundTrack: Track | undefined;
        let newExplicit = [...queueExplicit];
        let newSystem = [...queueSystem];
        let newAI = [...queueAI];

        // Search in Explicit
        const expIndex = newExplicit.findIndex(t => (t.pipedId || t.id) === trackId);
        if (expIndex !== -1) {
            foundTrack = newExplicit[expIndex];
            skipped = newExplicit.slice(0, expIndex);
            newExplicit = newExplicit.slice(expIndex + 1);
        } else {
            // Not in Explicit -> All Explicit are skipped
            skipped = [...newExplicit];
            newExplicit = [];

            // Search in System
            const sysIndex = newSystem.findIndex(t => (t.pipedId || t.id) === trackId);
            if (sysIndex !== -1) {
                foundTrack = newSystem[sysIndex];
                skipped = [...skipped, ...newSystem.slice(0, sysIndex)];
                newSystem = newSystem.slice(sysIndex + 1);
            } else {
                // Not in System -> All System are skipped
                skipped = [...skipped, ...newSystem];
                newSystem = [];

                // Search in AI
                const aiIndex = newAI.findIndex(t => (t.pipedId || t.id) === trackId);
                if (aiIndex !== -1) {
                    foundTrack = newAI[aiIndex];
                    skipped = [...skipped, ...newAI.slice(0, aiIndex)];
                    newAI = newAI.slice(aiIndex + 1);
                }
            }
        }

        if (foundTrack) {
            // 2. Update History
            // Stack: [Most Recent Skipped, ..., Least Recent Skipped, Previous Current, Old History]
            const historyUpdate = [...skipped.reverse()];

            if (currentTrack) {
                historyUpdate.push(currentTrack);

                // Record signal for Previous Current
                if (startTime) {
                    const dwellTime = (Date.now() - startTime) / 1000;
                    sendSignal(currentTrack.pipedId || currentTrack.id || '', 'DWELL', dwellTime);
                }
            }

            set({
                currentTrack: foundTrack,
                isPlaying: true,
                startTime: Date.now(),
                queueExplicit: newExplicit,
                queueSystem: newSystem,
                queueAI: newAI,
                history: [...historyUpdate, ...get().history]
            });

            addToHistory(foundTrack, playbackContext);
            get().checkSmartQueue();
        }
    },

    checkSmartQueue: async () => {
        const { queueExplicit, queueSystem, queueAI, currentTrack, history } = get();
        const totalQueueLength = queueExplicit.length + queueSystem.length + queueAI.length;

        // Rule 3: Always at least 15 suggested songs
        if (totalQueueLength < 15 && currentTrack) {
            console.log('[SmartQueue] Fetching recommendations...');
            try {
                const historyIds = history.slice(0, 5).map(t => t.pipedId || t.id).join(',');

                const token = localStorage.getItem('token');
                if (!token) return;

                const res = await fetch(`/api/music/recommendations?seedTrackId=${currentTrack.pipedId || currentTrack.id}&seedTrackTitle=${encodeURIComponent(currentTrack.title)}&seedTrackArtist=${encodeURIComponent(currentTrack.uploaderName)}&historyIds=${encodeURIComponent(historyIds)}&limit=20`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    throw new Error(`Failed to fetch recommendations: ${res.status}`);
                }

                const recommendations = await res.json();

                if (!Array.isArray(recommendations)) {
                    console.warn('[SmartQueue] Recommendations response is not an array:', recommendations);
                    return;
                }

                const recentHistory = history.slice(0, 50);
                const currentQueue = [...queueExplicit, ...queueSystem, ...queueAI];

                const newTracks = recommendations.filter((rec: any) =>
                    rec.pipedId !== currentTrack.pipedId &&
                    !currentQueue.some(q => q.pipedId === rec.pipedId) &&
                    !recentHistory.some(h => h.pipedId === rec.pipedId)
                );

                if (newTracks.length > 0) {
                    // Append to queueAI
                    set((state) => ({
                        queueAI: [...state.queueAI, ...newTracks.map((t: any) => ({ ...t, id: t.pipedId, isManual: false }))]
                    }));
                    console.log(`[SmartQueue] Added ${newTracks.length} tracks`);
                } else {
                    console.warn('[SmartQueue] No new tracks found after filtering. Consider relaxing filter or fetching more.');
                }
            } catch (err) {
                console.error('[SmartQueue] Failed to fetch', err);
            }
        }
    }
}));
