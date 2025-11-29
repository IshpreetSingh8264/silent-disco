# Technical Implementation Details

## 1. Smart Recommendation Engine
The heart of our "infinite playback" feature is the Smart Recommendation Engine.

### Strategy: "Contextual Mixing"
Instead of relying on a single data source, we use a mixed strategy to generate recommendations:
1.  **Seed Track Title**: We search for the track title to find covers, remixes, and semantically related songs.
2.  **Seed Track Artist**: We search for "Top songs by [Artist]" to find hits from the same artist.
3.  **Trending Fallback**: If no context is available, we fall back to global trending charts.

**Implementation**:
-   Endpoint: `/api/music/recommendations`
-   The backend performs these searches in parallel using `ytmusic-api`.
-   Results are deduplicated (by `videoId`) and filtered to remove the seed track itself.
-   **Caching**: Results are cached in Redis for 1 hour (`recommendations:{videoId}:v2`) to prevent redundant API calls.

## 2. Smart Queue (Frontend Logic)
The frontend ensures the music never stops.
-   **Buffer Monitoring**: The `Player.tsx` component monitors the `queue.length`.
-   **Threshold**: If the queue drops below **5 songs**, it triggers a fetch to the recommendation endpoint.
-   **Auto-Add**: It fetches **10 new songs** and appends them to the local queue (or room queue if host).
-   **Duplicate Prevention**: Before adding, it checks both the current queue and the play history to ensure variety.

## 3. Real-Time Synchronization (Socket.IO)
Rooms rely on an event-driven architecture.
-   **Events**:
    -   `join_room` / `leave_room`: Manages membership.
    -   `play` / `pause` / `seek`: Broadcasts playback state.
    -   `queue_update`: Broadcasts the entire queue structure when changed.
    -   `sync_request`: New users ask for current state upon joining.
-   **Optimistic UI**: The frontend updates immediately on user action, then reconciles with the server event to ensure perceived latency is zero.

## 4. Dynamic Shelves (Home Page)
To mimic YouTube Music's home feed, we implemented a "Shelves" architecture.
-   **Endpoint**: `/api/music/home`
-   **Parallel Execution**: The server defines a configuration of shelves (e.g., "Quick Picks", "Indie Vibes") and executes search queries for all of them simultaneously using `Promise.all`.
-   **Structure**: Returns an array of `{ title: string, items: Track[] }`.
-   **Frontend Rendering**: `Home.tsx` renders these as horizontal scroll containers with snap physics.

## 5. Music Streaming Proxy
We do not expose YouTube URLs directly to the client to avoid CORS issues and tracking.
-   **Stream Extraction**: We use `yt-dlp` on the server to extract the raw audio stream URL (`m4a`).
-   **Proxy Endpoint**: `/api/music/streams/{videoId}` redirects the client's `<audio>` tag to the actual content URL.
