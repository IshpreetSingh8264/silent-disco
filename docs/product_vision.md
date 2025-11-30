# Product Vision: Silent Disco (RetroSync)

## 1. Core Identity
**Silent Disco** is a high-performance, self-hosted music streaming app with a retro-themed UI.
-   **Dual Modes**:
    1.  **Solo Mode**: Personal music streaming (like Spotify/YTM).
    2.  **Group Mode ("Rooms")**: Synchronized listening where everyone hears the same track.
-   **Philosophy**: Ad-free, user-controlled content, "Shared Immersion".

## 2. Functional Modules

### 2.1 User Accounts & Profiles
-   **Auth**: Email/Password (JWT).
-   **Profile**: Username, Display Name, Avatar, Status (Online/Idle/Offline).
-   **Preferences**: Theme (Retro-Dark/Light), Language, Explicit Toggle.
-   **Friends System**:
    -   Requests (Send/Accept/Block).
    -   Activity Feed ("Ishpreet is listening to...").
-   **Devices**: Multi-device support with active device handoff.

### 2.2 Music Model & Library
-   **Entities**: Track, Album, Artist, Playlist.
-   **User Data**: Liked Tracks/Albums/Playlists, Listening History (persisted), Skips/Replays.
-   **Structure**: Mimics YouTube Music (Official tracks, uploads, etc.).

### 2.3 Queue System
-   **Context-Aware**: Generated from Album, Playlist, or Mix.
-   **Smart Queue**: Auto-extends with recommendations when running low.
-   **Actions**: Play Next, Add to Queue, Drag-and-Drop, Clear.
-   **Persistence**: Queue state saved in Redis/DB; restored on reload.

### 2.4 Playlist System
-   **Types**: User, Collaborative, System (Liked, Daily Mixes, Moods).
-   **Management**: Create, Edit, Delete, Reorder, Public/Private/Unlisted.
-   **UX**: Quick "Add to Playlist" context menu.

### 2.5 Homepage & Recommendations
-   **Sections**:
    -   Continue Listening (Resume).
    -   For You (Daily/Personalized Mixes).
    -   "Because you listened to X".
    -   Trending / Moods.
-   **Engine**: Content-based (tags/genre) + Collaborative filtering + Re-ranking (familiarity vs exploration).

### 2.6 Group Listening ("Rooms")
-   **Model**: Host controls playback (unless guests allowed).
-   **Sync**: WebSocket-based synchronization of Track, Position, and State.
-   **UX**: "Now Playing" with member avatars, Chat (optional), Shared Queue.

### 2.7 UI/UX & Theming
-   **Aesthetic**: Retro-Dark / Retro-Light. Neon accents, CRT/Grain effects.
-   **Tech**: React, Tailwind, Framer Motion, Zustand.
-   **Animations**: Smooth transitions (<250ms).

## 3. Technical Stack (Current Implementation)
-   **Frontend**: React + TypeScript + Vite + Tailwind + Zustand.
-   **Backend**: Node.js + Fastify (High Performance) + Socket.IO.
-   **Database**: PostgreSQL (Prisma).
-   **Caching/Realtime**: Redis.
-   **Music Source**: `ytmusic-api` + `yt-dlp`.

## 4. Data Model (Target Schema)
-   **User**: `id`, `email`, `username`, `avatar`, `preferences`.
-   **Friend**: `requester_id`, `recipient_id`, `status`.
-   **Track**: `id`, `pipedId`, `title`, `artist`, `album`, `tags`.
-   **Playlist**: `id`, `owner_id`, `items`, `visibility`.
-   **History**: `user_id`, `track_id`, `played_at`, `context`.
-   **Room**: `id`, `host_id`, `queue`, `playback_state`.
