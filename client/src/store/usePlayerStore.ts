import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

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
    isPlayed?: boolean;
    isManual?: boolean;
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
    playNext: () => void;
    playPrevious: () => void;
    playTrack: (track: Track, context?: string) => void;
    playTrackFromQueue: (trackId: string) => void;
    playPlaylist: (tracks: Track[], startIndex?: number, context?: string) => void;
    togglePlay: () => void;
    setPlaying: (isPlaying: boolean) => void;
    addToQueue: (track: Track) => void;
    removeFromQueue: (queueId: string) => void;
    clearQueue: () => void;
    toggleShuffle: () => void;
    addToHistory: (track: Track, context: string) => Promise<void>;
    sendSignal: (trackId: string, type: string, value?: number, metadata?: any) => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
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

    playTrack: (track, context = 'search') => {
        const { currentTrack, history, addToHistory, startTime, sendSignal } = get();

        // Record signals for previous track
        if (currentTrack && startTime) {
            const dwellTime = (Date.now() - startTime) / 1000;
            sendSignal(currentTrack.pipedId || currentTrack.id || '', 'DWELL', dwellTime);
            if (dwellTime < 30) sendSignal(currentTrack.pipedId || currentTrack.id || '', 'SKIP', dwellTime);
            set({ history: [currentTrack, ...history] });
        }

        // Rule 1 & 2: Context Switch -> Reset Queue (except explicit? User said "User actions always reset the context")
        // But Rule 2 says "resetUpNext()", implying clearing system/AI.
        // Rule 5 says "Explicit > System > AI".
        // If user plays a NEW song from search, it's a new context.
        // Usually explicit queue is preserved in Spotify/YTM unless it was a "Play Next" action?
        // User said: "If played from search/home: clear previous queue and apply recommendation"
        // So we clear System and AI. Explicit? "User actions always reset the context".
        // Let's assume we clear System and AI, but keep Explicit if it was manually added?
        // Actually, "If played from search/home: clear previous queue". This implies clearing everything.

        set({
            currentTrack: track,
            isPlaying: true,
            playbackContext: context,
            queueSystem: [], // Clear system queue
            queueAI: [],     // Clear AI queue
            // queueExplicit: [], // User said "clear previous queue", but usually "Add to Queue" songs stick around?
            // Let's follow "User actions always reset the context" strictly for now.
            queueExplicit: [],
            startTime: Date.now()
        });
        addToHistory(track, context);
        get().checkSmartQueue(); // Fetch new recommendations
    },

    playPlaylist: (tracks: Track[], startIndex = 0, context = 'playlist') => {
        if (tracks.length === 0) return;
        const { currentTrack, history, addToHistory, startTime, sendSignal } = get();

        if (currentTrack && startTime) {
            const dwellTime = (Date.now() - startTime) / 1000;
            sendSignal(currentTrack.pipedId || currentTrack.id || '', 'DWELL', dwellTime);
            set({ history: [currentTrack, ...history] });
        }

        // Rule 6: Playlist Logic
        // 0..startIndex-1 -> History (We don't actually add them to history state to avoid clutter, just ignore them)
        // startIndex -> Current
        // startIndex+1..end -> System Queue

        const firstTrack = tracks[startIndex];
        const remainingTracks = tracks.slice(startIndex + 1);

        set({
            currentTrack: firstTrack,
            queueSystem: remainingTracks,
            queueExplicit: [], // Clear explicit on new playlist play
            queueAI: [],       // Clear AI
            isPlaying: true,
            isShuffle: false,
            playbackContext: context,
            startTime: Date.now()
        });
        addToHistory(firstTrack, context);
        get().checkSmartQueue(); // Will fetch recommendations to append after playlist
    },

    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
    setPlaying: (isPlaying: boolean) => set({ isPlaying }),

    addToQueue: (track) => set((state) => ({
        queueExplicit: [...state.queueExplicit, { ...track, isManual: true }]
    })),

    removeFromQueue: (queueId: string) => set((state) => ({
        queueExplicit: state.queueExplicit.filter(t => (t as any).queueId !== queueId && t.id !== queueId),
        queueSystem: state.queueSystem.filter(t => (t as any).queueId !== queueId && t.id !== queueId),
        queueAI: state.queueAI.filter(t => (t as any).queueId !== queueId && t.id !== queueId)
    })),

    clearQueue: () => set({ queueExplicit: [], queueSystem: [], queueAI: [] }),

    toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),

    playNext: () => {
        const { queueExplicit, queueSystem, queueAI, currentTrack, addToHistory, playbackContext, startTime, sendSignal } = get();

        // Record signals
        if (currentTrack && startTime) {
            const dwellTime = (Date.now() - startTime) / 1000;
            sendSignal(currentTrack.pipedId || currentTrack.id || '', 'DWELL', dwellTime);
            set({ history: [currentTrack, ...get().history] });
        }

        // Priority: Explicit > System > AI
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
                // Remove from source queue
                queueExplicit: sourceQueue === 'explicit' ? queueExplicit.slice(1) : queueExplicit,
                queueSystem: sourceQueue === 'system' ? queueSystem.slice(1) : queueSystem,
                queueAI: sourceQueue === 'ai' ? queueAI.slice(1) : queueAI
            });
            addToHistory(nextTrack, playbackContext);
            get().checkSmartQueue(); // Ensure we maintain 15 tracks
        } else {
            set({ isPlaying: false });
        }
    },

    playPrevious: () => {
        const { history, playTrack, playbackContext } = get();
        if (history.length > 0) {
            const previousTrack = history[0];
            const newHistory = history.slice(1);
            // Just play it, reset queue? No, usually "Previous" just plays the song and keeps queue.
            // But for simplicity and maintaining state consistency:
            set({
                currentTrack: previousTrack,
                history: newHistory,
                isPlaying: true,
                startTime: Date.now()
            });
        }
    },

    addToHistory: async (track: Track, context: string) => {
        try {
            const { token } = useAuthStore.getState();
            if (!token) return;
            await fetch('/api/user/history', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ track, context })
            });
        } catch (err) {
            console.error('[History] Failed to save', err);
        }
    },

    sendSignal: async (trackId: string, type: string, value?: number, metadata?: any) => {
        try {
            const { token } = useAuthStore.getState();
            if (!token) return;
            await fetch('/api/user/signals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ trackId, type, value, metadata })
            });
        } catch (err) {
            console.error('[Signal] Failed to send', err);
        }
    },

    playTrackFromQueue: (trackId: string) => {
        const { queueExplicit, queueSystem, queueAI, currentTrack, addToHistory, playbackContext, startTime, sendSignal } = get();

        // Record signals for previous track
        if (currentTrack && startTime) {
            const dwellTime = (Date.now() - startTime) / 1000;
            sendSignal(currentTrack.pipedId || currentTrack.id || '', 'DWELL', dwellTime);
            set({ history: [currentTrack, ...get().history] });
        }

        let foundTrack: Track | undefined;
        let newExplicit = [...queueExplicit];
        let newSystem = [...queueSystem];
        let newAI = [...queueAI];

        // Search in Explicit
        const expIndex = newExplicit.findIndex(t => (t.pipedId || t.id) === trackId);
        if (expIndex !== -1) {
            foundTrack = newExplicit[expIndex];
            newExplicit = newExplicit.slice(expIndex + 1);
        } else {
            // Search in System
            const sysIndex = newSystem.findIndex(t => (t.pipedId || t.id) === trackId);
            if (sysIndex !== -1) {
                foundTrack = newSystem[sysIndex];
                newExplicit = []; // Skip all explicit
                newSystem = newSystem.slice(sysIndex + 1);
            } else {
                // Search in AI
                const aiIndex = newAI.findIndex(t => (t.pipedId || t.id) === trackId);
                if (aiIndex !== -1) {
                    foundTrack = newAI[aiIndex];
                    newExplicit = []; // Skip all explicit
                    newSystem = [];   // Skip all system
                    newAI = newAI.slice(aiIndex + 1);
                }
            }
        }

        if (foundTrack) {
            set({
                currentTrack: foundTrack,
                isPlaying: true,
                startTime: Date.now(),
                queueExplicit: newExplicit,
                queueSystem: newSystem,
                queueAI: newAI
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

                const res = await fetch(`/api/music/recommendations?seedTrackId=${currentTrack.pipedId || currentTrack.id}&seedTrackTitle=${encodeURIComponent(currentTrack.title)}&seedTrackArtist=${encodeURIComponent(currentTrack.uploaderName)}&historyIds=${encodeURIComponent(historyIds)}&limit=20`);
                const recommendations = await res.json();

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
