import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './useAuthStore';
import { SOCKET_URL } from '../config/api';

export interface RoomMember {
    id: string;
    userId: string;
    username: string;
    email: string;
    role: 'HOST' | 'MEMBER';
    canAddQueue: boolean;
    canManageQueue: boolean;
    canControlPlayback: boolean;
}

export interface RoomQueueItem {
    id: string;
    queueId: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: number;
    url: string;
    pipedId: string;
    uploaderName: string;
    isPlayed: boolean;
}

interface RoomState {
    socket: Socket | null;
    roomCode: string | null;
    isHost: boolean;
    members: RoomMember[];
    queue: RoomQueueItem[];
    currentTrack: RoomQueueItem | null;
    isPlaying: boolean;
    position: number;
    lastSyncTime: number;
    isSynced: boolean;
    isSeeking: boolean;

    connect: (roomCode: string) => void;
    disconnect: () => void;
    play: (track: any) => void;
    pause: () => void;
    seek: (position: number) => void;
    playNext: () => void;
    playPrevious: () => void;
    addToQueue: (track: any) => void;
    removeFromQueue: (queueId: string) => void;
    updatePermissions: (memberId: string, permissions: Partial<Pick<RoomMember, 'canAddQueue' | 'canManageQueue' | 'canControlPlayback'>>) => void;
    setPosition: (position: number) => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
    socket: null,
    roomCode: null,
    isHost: false,
    members: [],
    queue: [],
    currentTrack: null,
    isPlaying: false,
    position: 0,
    lastSyncTime: 0,
    isSynced: false,
    isSeeking: false,

    setPosition: (position: number) => set({ position }),

    connect: (roomCode: string) => {
        const { token } = useAuthStore.getState();
        const currentSocket = get().socket;

        if (currentSocket && get().roomCode === roomCode) {
            if (!currentSocket.connected) {
                currentSocket.connect();
            }
            return;
        }

        if (currentSocket) {
            currentSocket.disconnect();
        }

        console.log(`[RoomStore] Connecting to room ${roomCode}`);

        const socket = io(SOCKET_URL || '/', {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        set({ socket, roomCode });

        // Less frequent sync to avoid conflicts - only for reconnection/drift correction
        const heartbeatInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('request_sync', { roomCode });
            }
        }, 10000); // 10 seconds instead of 3

        socket.on('connect', () => {
            console.log('[RoomStore] Connected to socket, joining room...');
            socket.emit('join_room', { roomCode });
        });

        socket.on('reconnect', () => {
            console.log('[RoomStore] Reconnected, re-joining room...');
            socket.emit('join_room', { roomCode });
        });

        socket.on('is_host', (isHost: boolean) => {
            console.log(`[RoomStore] isHost=${isHost}`);
            set({ isHost });
        });

        socket.on('members_update', (members: RoomMember[]) => {
            set({ members });
        });

        socket.on('sync_state', (state) => {
            console.log('[RoomStore] sync_state received:', state.position, state.isPlaying);
            const currentState = get();

            // Only update if not currently seeking and position differs significantly
            const drift = Math.abs(currentState.position - state.position);
            if (drift > 2 || !currentState.isSynced) {
                set({
                    isPlaying: state.isPlaying,
                    position: state.position,
                    currentTrack: state.track,
                    queue: state.queue,
                    lastSyncTime: Date.now(),
                    isSynced: true
                });
            }
        });

        socket.on('queue_update', (queue) => {
            set({ queue });
        });

        socket.on('play', ({ track, position }) => {
            console.log('[RoomStore] play event:', track?.title, 'at', position);
            set({
                currentTrack: track,
                isPlaying: true,
                position: position ?? 0,
                lastSyncTime: Date.now()
            });
        });

        socket.on('pause', ({ position }) => {
            console.log('[RoomStore] pause event at position:', position);
            set({
                isPlaying: false,
                position: position ?? get().position,
                lastSyncTime: Date.now()
            });
        });

        socket.on('seek', ({ position }) => {
            console.log('[RoomStore] seek event to position:', position);
            set({
                position,
                lastSyncTime: Date.now()
            });
        });

        socket.on('disconnect', () => {
            console.log('[RoomStore] Disconnected from socket');
            set({ isSynced: false });
            clearInterval(heartbeatInterval);
        });
    },

    disconnect: () => {
        const { socket, roomCode } = get();
        if (socket) {
            if (roomCode) {
                socket.emit('leave_room');
            }
            socket.disconnect();
        }
        set({
            socket: null,
            roomCode: null,
            isHost: false,
            members: [],
            queue: [],
            currentTrack: null,
            isPlaying: false,
            isSynced: false
        });
    },

    play: (track) => {
        const { socket, roomCode, position } = get();
        if (socket && roomCode) {
            // When resuming, use current position; when playing new track, use 0
            const isNewTrack = get().currentTrack?.pipedId !== track.pipedId;
            socket.emit('play', { roomCode, track, position: isNewTrack ? 0 : position });
        }
    },

    pause: () => {
        const { socket, roomCode, position } = get();
        if (socket && roomCode) {
            socket.emit('pause', { roomCode, position });
        }
    },

    seek: (position) => {
        const { socket, roomCode } = get();
        if (socket && roomCode) {
            set({ position, isSeeking: true });
            socket.emit('seek', { roomCode, position });
            // Reset seeking flag after a short delay
            setTimeout(() => set({ isSeeking: false }), 500);
        }
    },

    playNext: () => {
        const { socket, roomCode, queue } = get();
        if (!socket || !roomCode) return;

        const upNext = queue.filter(t => !t.isPlayed);
        if (upNext.length > 0) {
            const nextTrack = upNext[0];
            socket.emit('play', { roomCode, track: nextTrack, position: 0 });
        }
    },

    playPrevious: () => {
        const { socket, roomCode, queue, currentTrack, position } = get();
        if (!socket || !roomCode) return;

        // If more than 3 seconds in, restart current track
        if (position > 3 && currentTrack) {
            socket.emit('seek', { roomCode, position: 0 });
            return;
        }

        // Find previous played track in queue (history)
        const history = queue.filter(t => t.isPlayed && t.pipedId !== currentTrack?.pipedId);
        if (history.length > 0) {
            const prevTrack = history[history.length - 1];
            socket.emit('play', { roomCode, track: prevTrack, position: 0 });
        } else if (currentTrack) {
            // No history, just restart current
            socket.emit('seek', { roomCode, position: 0 });
        }
    },

    addToQueue: (track) => {
        const { socket, roomCode } = get();
        if (socket && roomCode) {
            socket.emit('queue_add', { roomCode, track });
        }
    },

    removeFromQueue: (queueId: string) => {
        const { socket, roomCode } = get();
        if (socket && roomCode) {
            socket.emit('queue_remove', { roomCode, queueId });
        }
    },

    updatePermissions: (memberId, permissions) => {
        const { socket, roomCode } = get();
        if (socket && roomCode) {
            socket.emit('update_permissions', { roomCode, memberId, permissions });
        }
    }
}));
