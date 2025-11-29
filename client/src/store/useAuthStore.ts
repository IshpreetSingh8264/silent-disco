import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface User {
    id: string;
    username: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    socket: Socket | null;
    login: (user: User, token: string) => void;
    logout: () => void;
    initializeSocket: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token'),
    socket: null,

    login: (user, token) => {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('token', token);
        set({ user, token });
        get().initializeSocket();
    },

    logout: () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        get().socket?.disconnect();
        set({ user: null, token: null, socket: null });
    },

    initializeSocket: () => {
        const { token, socket } = get();
        if (token && !socket) {
            const newSocket = io('http://localhost:3000', {
                auth: { token },
            });
            set({ socket: newSocket });
        }
    },
}));
