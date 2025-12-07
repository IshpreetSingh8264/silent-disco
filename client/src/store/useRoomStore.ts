import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './useAuthStore';

export interface RoomMember {
    id: string;
    userId: string;
    username: string;
    email: string;
    role?: string;
    canAddQueue: boolean;
    canManageQueue: boolean;
    canControlPlayback: boolean;
}

export interface RoomQueueItem {
    id: string; // Track ID
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

    connect: (roomCode: string, userId: string) => void;
    disconnect: () => void;
    play: (track: any) => void;
    pause: () => void;
    seek: (position: number) => void;
    addToQueue: (track: any) => void;
    removeFromQueue: (queueId: string) => void;
    updatePermissions: (memberId: string, permissions: Partial<RoomMember>) => void;
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

    setIsHost: (isHost: boolean) => set({ isHost }),

    connect: (roomCode: string, userId: string) => {
        const { token } = useAuthStore.getState();
        const currentSocket = get().socket;

        // If we already have a socket and it's for the same room, do nothing
        if (currentSocket && get().roomCode === roomCode) {
            if (!currentSocket.connected) {
                currentSocket.connect();
            }
            return;
        }

        // If we have a socket but for a different room, disconnect it
        if (currentSocket) {
            currentSocket.disconnect();
        }

        console.log(`Connecting to room ${roomCode} as ${userId}`);

        const socket = io('/', {
            auth: { token },
            transports: ['websocket', 'polling'] // Force websocket if possible
        });

        set({ socket, roomCode });

        // Heartbeat / Sync Interval
        const heartbeatInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('request_sync', { roomCode });
            }
        }, 5000); // Sync every 5 seconds

        socket.on('connect', () => {
            console.log('Connected to room socket, joining room...');
            socket.emit('join_room', { roomCode, userId });
        });

        // Handle reconnection
        socket.on('reconnect', () => {
            console.log('Reconnected, re-joining room...');
            socket.emit('join_room', { roomCode, userId });
        });

        socket.on('is_host', (isHost: boolean) => {
            set({ isHost });
        });

        socket.on('members_update', (members: RoomMember[]) => {
            set({ members });
        });

        socket.on('permissions_update', ({ memberId, permissions }) => {
            set((state) => ({
                members: state.members.map((m) =>
                    m.id === memberId ? { ...m, ...permissions } : m
                )
            }));
        });

        socket.on('sync_state', (state) => {
            // console.log('Sync state:', state);
            set({
                isPlaying: state.isPlaying,
                position: state.position,
                currentTrack: state.track,
                queue: state.queue,
                lastSyncTime: state.timestamp,
                isSynced: true
            });
        });

        socket.on('queue_update', (queue) => {
            set({ queue });
        });

        socket.on('play', ({ track, position }) => {
            set({ currentTrack: track, isPlaying: true, position });
        });

        socket.on('pause', () => {
            set({ isPlaying: false });
        });

        socket.on('seek', ({ position }) => {
            set({ position });
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from socket');
            set({ isSynced: false });
            clearInterval(heartbeatInterval);
        });
    },

    disconnect: () => {
        const { socket } = get();
        if (socket) {
            socket.disconnect();
        }
        set({ socket: null, roomCode: null, isHost: false, members: [], queue: [], currentTrack: null, isPlaying: false, isSynced: false });
    },

    play: (track) => {
        const { socket, roomCode } = get();
        if (socket && roomCode) {
            socket.emit('play', { roomCode, track, position: 0 });
        }
    },

    pause: () => {
        const { socket, roomCode } = get();
        if (socket && roomCode) {
            socket.emit('pause', { roomCode });
        }
    },

    seek: (position) => {
        const { socket, roomCode } = get();
        if (socket && roomCode) {
            socket.emit('seek', { roomCode, position });
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
