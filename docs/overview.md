# Silent Disco - Project Overview

## Ideology & Vision
**Silent Disco** is a retro-themed, collaborative music streaming platform designed to bring the "listening party" experience to the web. Our core philosophy is **"Shared Immersion"**—creating a space where users can listen together in real-time, regardless of physical location, wrapped in a premium, nostalgic aesthetic.

We aim to bridge the gap between solitary music streaming and social listening. Unlike standard platforms where "social" features are often an afterthought (e.g., sharing a link), Silent Disco puts the **Room** at the center of the experience.

### Key Goals
1.  **Premium Retro Aesthetic**: A visually stunning UI that blends "Cyberpunk/Retro" vibes with modern glassmorphism. It should feel like a high-end, dedicated music player, not just a website.
2.  **Seamless Collaboration**: Real-time synchronization of playback, queue management, and state across all users in a room.
3.  **Smart Discovery**: An intelligent system that keeps the music playing even when the users stop adding songs, mimicking a personalized radio station.
4.  **YouTube Music Experience**: A user experience that rivals top-tier streaming services (YouTube Music, Spotify) in terms of fluidity, recommendations, and feature set (lyrics, related tracks, dynamic shelves).

## High-Level Architecture
The application is built as a modern full-stack web application:

-   **Frontend**: React (Vite) with TypeScript, Tailwind CSS for styling, and Zustand for state management. It focuses on a responsive, single-page application (SPA) experience.
-   **Backend**: Node.js with Fastify, providing a robust API for music metadata, streaming, and user management.
-   **Real-Time Layer**: Socket.IO handles the bidirectional communication required for room synchronization (play/pause, seek, queue updates).
-   **Database**: PostgreSQL (via Prisma ORM) stores persistent data (users, rooms, playlists).
-   **Caching & Performance**: Redis is used heavily to cache search results, recommendations, and trending data to ensure instant load times and reduce API rate limits.
-   **Music Source**: We utilize `ytmusic-api` and `yt-dlp` to source high-quality metadata and audio streams from YouTube Music, providing an immense library without direct dependency on paid APIs.

## Core Features
-   **Virtual Rooms**: Create or join rooms with a unique code.
-   **Smart Queue**: Automatically populates with relevant tracks based on the current context (Artist + Title).
-   **Dynamic Home**: "Shelves" of content (Trending, Quick Picks, New Releases) just like YouTube Music.
-   **Immersive Player**: A split-screen player view with lyrics, up-next, and related tracks.
