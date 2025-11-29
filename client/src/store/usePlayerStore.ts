import { create } from 'zustand';

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
}

interface PlayerState {
    currentTrack: Track | null;
    isPlaying: boolean;
    queue: Track[];
    isShuffle: boolean;
    playTrack: (track: Track) => void;
    togglePlay: () => void;
    setPlaying: (isPlaying: boolean) => void;
    addToQueue: (track: Track) => void;
    setQueue: (queue: Track[]) => void;
    removeFromQueue: (queueId: string) => void;
    clearQueue: () => void;
    toggleShuffle: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
    currentTrack: null,
    isPlaying: false,
    queue: [],
    isShuffle: false,

    playTrack: (track) => set({ currentTrack: track, isPlaying: true }),
    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
    setPlaying: (isPlaying: boolean) => set({ isPlaying }),
    addToQueue: (track) => set((state) => ({ queue: [...state.queue, track] })),
    setQueue: (queue: Track[]) => set({ queue }),
    removeFromQueue: (queueId: string) => set((state) => ({
        queue: state.queue.filter(t => (t as any).queueId !== queueId)
    })),
    clearQueue: () => set({ queue: [] }),
    toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),
}));
