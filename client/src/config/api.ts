// API and Socket.IO configuration
// In production, use relative URLs (Nginx proxies /api and /socket.io)
// In development, use localhost:3000

const isDev = import.meta.env.DEV;

// For API calls - use relative paths so Nginx can proxy
export const API_BASE_URL = isDev ? 'http://localhost:3000' : '';

// For Socket.IO - in production, connect to same origin; in dev, use localhost
export const SOCKET_URL = isDev ? 'http://localhost:3000' : '';

// Helper to build API URLs
export const apiUrl = (path: string): string => {
    if (path.startsWith('/')) {
        return `${API_BASE_URL}${path}`;
    }
    return `${API_BASE_URL}/${path}`;
};
