# Implementation Plan - Silent Disco

## Goal Description
Build a self-hosted, ad-free group music listening application ("Silent Disco"). Users can create rooms, join via code, and listen to music in perfect sync. The app features a high-performance Node.js backend with Prisma/PostgreSQL and a feature-rich "Retro Dark" React frontend.

## User Review Required
> [!IMPORTANT]
> **Audio Source**: To achieve "ad-free" playback without cost, this application will use **Piped** (an alternative privacy-friendly YouTube frontend) public APIs to fetch audio streams. This avoids direct YouTube API quotas and ads.
> **Legal**: Streaming copyrighted content may have legal implications depending on your jurisdiction. This software is a platform; you are responsible for how it is used.

### Backend
#### [MODIFY] [schema.prisma](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/server/prisma/schema.prisma)
- Add `LikedTrack` model for user's liked songs.
- Update `User` and `Track` relations.
- Add `email` field to `User` model (unique).

#### [NEW] [library.ts](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/server/src/routes/library.ts)
- `GET /api/library/playlists`: Get user's playlists.
- `POST /api/library/playlists`: Create new playlist.
- `GET /api/library/playlists/:id`: Get playlist details.
- `POST /api/library/playlists/:id/tracks`: Add track to playlist.
- `GET /api/library/liked`: Get liked songs.
- `POST /api/library/liked`: Toggle like on a track.

#### [MODIFY] [auth.ts](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/server/src/routes/auth.ts)
- Update Login to accept **Email ONLY**.
- Keep Username for display/profile purposes only.

## Social & User Features

### Backend
#### [NEW] [user.ts](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/server/src/routes/user.ts)
- Implement `GET /history` and `POST /history` to track listening habits.
- Implement Friends API.

### Database
#### [MODIFY] [schema.prisma](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/server/prisma/schema.prisma)
- Add `ListeningHistory` model.
- Add `Friendship` model.

## Advanced Recommendation & Queue Engine (Integrated Python + Node.js)

### Architecture
- **Node.js Backend**: Main application server.
- **Python AI Script**: CLI script (`recommend.py`) executed by Node.js via `child_process`.
    - **Input**: JSON string via stdin (User ID, Context, History).
    - **Output**: JSON string via stdout (Recommendations).
    - **Benefit**: No separate server process to manage.

### Database
#### [MODIFY] [schema.prisma](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/server/prisma/schema.prisma)
- (Already updated with UserSignal, TrackFeature, ContextLog)

### Python Script (`/ai-engine/recommend.py`)
- **Logic**: Same as before (Candidate Generation -> Ranking), but adapted for CLI usage.
- **Dependencies**: `ytmusicapi`, `pandas`, `scikit-learn`.

### Frontend Queue Logic (Enterprise Rules)
#### [MODIFY] [usePlayerStore.ts](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/client/src/store/usePlayerStore.ts)
- **State Structure**:
    - `queueExplicit`: User-added songs (High priority).
    - `queueSystem`: Playlist/Album tracks (Medium priority).
    - `queueAI`: Auto-generated recommendations (Low priority).
    - `queue`: Computed getter `[...explicit, ...system, ...ai]`.
- **Actions**:
    - `playTrack(track)`:
        - Reset `queueExplicit`, `queueSystem`, `queueAI`.
        - Set `currentTrack`.
        - Fetch recommendations -> `queueAI`.
    - `playPlaylist(tracks, startIndex)`:
        - `0..startIndex-1` -> History.
        - `startIndex` -> `currentTrack`.
        - `startIndex+1..end` -> `queueSystem`.
        - Clear `queueExplicit`, `queueAI`.
        - Fetch recommendations -> `queueAI` (appended after system).
    - `addToQueue(track)`: Append to `queueExplicit`.
    - `playNext()`:
        - Move `currentTrack` to `history`.
        - Pop from `explicit` -> `system` -> `ai`.
        - If `totalQueue < 15`, fetch more AI tracks.

### Frontend
#### [NEW] [Library.tsx](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/client/src/pages/Library.tsx)
- View all playlists and "Liked Songs" entry.

#### [NEW] [PlaylistDetail.tsx](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/client/src/pages/PlaylistDetail.tsx)
- View tracks in a playlist.
- Play button for whole playlist.

#### [MODIFY] [music.ts](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/server/src/routes/music.ts)
- Replace Piped API with `ytmusic-api` for metadata.
- Use `@distube/ytdl-core` for resolving stream URLs directly.
- `GET /api/music/trending`: Fetch from `ytmusic-api` charts.
- `GET /api/music/search`: Fetch from `ytmusic-api` search.
- `GET /api/music/streams/:videoId`: Resolve audio URL via `ytdl-core`.

### Frontend
#### [NEW] [Home.tsx](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/client/src/pages/Home.tsx)
- Fetch and display trending music.
- "Quick Picks" section (randomized or history-based if possible, for now just trending).
- Hero section with a featured track.

#### [MODIFY] [Layout.tsx](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/client/src/components/Layout.tsx)
- Ensure Home link points to `/`.

#### [MODIFY] [Login.tsx](file:///run/media/ishpreet/New%20Volume/Productivity/Silent%20Disco/client/src/pages/Login.tsx)
- Implement **Frontend Validation** (Email format, Password strength) before API call.
- Update Login form to use Email only.
- Update Signup form to require Email, Username (display name), Password.

## Proposed Changes

### Architecture
- **Monorepo Structure**:
    - `/server`: Node.js backend (Fastify + Prisma + WebSocket).
    - `/client`: React frontend.
- **Database**: PostgreSQL (via Docker Compose).
- **ORM**: Prisma.

### Backend (Node.js + TypeScript)
#### [NEW] /server
- **Framework**: Fastify (High performance).
- **Language**: TypeScript.
- **ORM**: Prisma (Schema: `User`, `Room`, `Playlist`, `Track`, `Session`).
- **Real-time**: `socket.io` or `ws` for robust group sync and presence.
- **Modules**:
    - `auth`: JWT-based authentication.
    - `gateway`: WebSocket gateway for room events (join, leave, play, pause, seek).
    - `music`: Wrapper around Piped API (Search, Stream, Lyrics, Recommendations).
    - `library`: User library management (Playlists, Favorites).
    - `cache`: Redis service for caching music metadata and search results.

#### [NEW] Smart Features
- **Smart Queue**: Automatically add recommended songs when queue is low (< 5 songs).
- **Smart Search Strategy**: Combine "Related Search" and "Artist Top Songs" to mimic radio.
- **History**: Retain played songs in queue as "History" (mark `isPlayed`).
- **Smart Shuffle**: Shuffle unplayed songs while keeping "vibe".
- `GET /api/music/recommendations`: Get related songs (Smart Search).

### Infrastructure
- **Redis**: In-memory data store for caching and session management.

### Frontend (React)
#### [NEW] /client
- **Build Tool**: Vite.
- **Styling**: Tailwind CSS with "Retro Dark" config (Neon accents, dark backgrounds, glassmorphism).
- **State Management**: Zustand.
- **Animations**: Framer Motion (Page transitions, micro-interactions).
- **Frontend Features**
- [ ] **Navigation & Layout**
    - [ ] **Navbar**: Create a top navigation bar containing the Search Bar, Cast icon, and Profile icon.
    - [ ] **Sidebar**: Update sidebar to match YTM (Home, Explore, Library, Upgrade).
    - [ ] **Layout**: Integrate Navbar into the main content area, sticky at the top.

- [ ] **Home Page (`Home.tsx`)**
    - [ ] **Category Pills**: "Podcasts", "Romance", "Relax", "Focus", etc. at the top.
    - [ ] **Quick Picks**: 4x5 Grid layout for quick access to favorite tracks.
    - [ ] **Listen Again**: Horizontal carousel of recent history.
    - [ ] **Dynamic Shelves**: "New releases", "Recommended music videos", etc.

- [ ] **Explore Page (`Explore.tsx`)**
    - [ ] **Navigation**: Buttons for "New releases", "Charts", "Moods & genres".
    - [ ] **New Releases**: Grid of new albums/singles.
    - [ ] **Moods & Genres**: Categorized lists.

- [ ] **Search**
    - [ ] **Global Search**: Search bar in the Navbar, accessible from anywhere.
    - [ ] **Results Page**: Categorized results (Songs, Videos, Albums, Playlists).
- **Player**:
    - **Main**: Album art, controls, "Up Next" / "Lyrics" / "Related" tabs.
    - **Queue**: Robust queue management (drag-and-drop, remove, clear).
    - **Related**: Powered by `getUpNexts` for true YouTube Music recommendations.
- **Room**: Invite system, Member list, Chat (optional), Real-time sync status.
- **Artist/Album**: Detail pages with tracklists and metadata.

  ## Enterprise Database Schema Design
  ### New Models
  - **`UserQueue`**: Persistent queue for each user.
      - `userId` (FK), `trackId` (FK), `position` (Float for easy reordering), `source` (enum: MANUAL, SYSTEM, AI).
      - Index: `[userId, position]`.
  - **`UserTrackStats`**: Aggregated stats to avoid expensive history scans.
      - `userId`, `trackId`, `playCount`, `skipCount`, `lastPlayedAt`.
      - Index: `[userId, playCount DESC]` (Fast "Top Tracks").
  - **`TrackRegionStats`**: For "Trending" by region.
      - `trackId`, `countryCode`, `playCount`, `trendingScore`.
      - Index: `[countryCode, trendingScore DESC]`.

  ### Optimizations
  - **`ListeningHistory`**:
      - Add `durationPlayed` (Int) to filter "real" plays.
      - *Partitioning Strategy*: Range partition by `playedAt` (monthly).
  - **`UserSignal`**:
      - *Partitioning Strategy*: Range partition by `createdAt` (weekly/monthly).
  - **`Track`**:
      - Add `globalPlayCount` for general popularity.

  ## Real Data Integration
  ### Backend Endpoints
  - **`GET /api/music/home`**: Aggregates data for:
      - **Listen Again**: Query `ListeningHistory` (distinct tracks, recent first).
      - **Your Playlists**: Query `Playlist` (owned by user).
      - **For You**: Call Python AI with `UserTrackStats` + `ContextLog`.
      - **Trending**: Query `TrackRegionStats` (by user's region).
      - **New Releases**: Query `Track` (sorted by release date, filtered by user's genres).
  - **`POST /api/queue`**: Sync queue state to `UserQueue`.

  ### Frontend Updates
  - **`Home.tsx`**: Fetch from `/api/music/home` and render real sections.
  - **`Navbar.tsx`**: Remove unused icons, update Logo.
  - **`Settings`**: Add "Region" selector.
  
  ### Queue System
  - [ ] Frontend: Move queue logic from `Player.tsx` `useEffect` to `usePlayerStore` or `useQueue` hook.
  - [ ] Frontend: Implement "History" tracking to prevent duplicate recommendations.
  - [ ] Frontend: Fix "Add to Queue" vs "Play Next" behavior.

  ### Playlist System
  - [ ] Frontend: Create `Library` page to list playlists.
  - [ ] Frontend: Create `PlaylistDetail` page.
  - [ ] Frontend: Implement "Add to Playlist" modal.
  - [ ] Backend: Verify `library.ts` endpoints handle `pipedId` vs `id` correctly.

  ## Social & User Features (New)
  ### Friends System
  - [ ] Backend: Create `Friend` model and API (Request, Accept, Block).
  - [ ] Backend: Add "Activity Feed" endpoint (what friends are listening to).
  - [ ] Frontend: Create "Friends" sidebar/modal.

  ### User Profile & Settings
  - [ ] Backend: Update `User` model with `avatar`, `status`, `preferences`.
  - [ ] Frontend: Create Profile page (Edit Avatar, Change Theme).
  - [ ] Frontend: Persist Theme (Retro-Dark/Light) to DB/LocalStorage.

  ### History & Persistence
  - [ ] Backend: Create `ListeningHistory` model.
  - [ ] Backend: Endpoint to log play (called when track starts/completes).
  - [ ] Frontend: "Recently Played" section on Home.

  ## Verification Plan
  ### Automated Tests
  - Backend: Jest/Vitest for API and Logic tests.
- Frontend: Build check (`npm run build`).

### Manual Verification
1.  **Sync Test**: Open two browser windows. Create a room in one, join in the other. Play a song. Verify both start playing. Pause in one, verify pause in other.
2.  **Ad-Free Test**: Search for a popular song. Play it. Verify audio plays without pre-roll ads.
3.  **Feature Test**: Create a playlist, add songs, play the playlist.
4.  **Theme Test**: Verify "Retro Dark" aesthetic.
5.  **Smart Features Test**: Verify queue auto-fills, history is retained, and shuffle works.
