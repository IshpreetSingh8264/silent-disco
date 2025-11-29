# Database Schema & Data Store

## PostgreSQL Schema (Prisma)

### `User`
Represents a registered user of the platform.
-   `id`: UUID (PK)
-   `email`: String (Unique)
-   `username`: String (Unique)
-   `password`: String (Hashed)
-   `createdAt`: DateTime
-   *Relations*: `hostedRooms`, `memberOf`, `playlists`, `likedTracks`

### `Room`
A collaborative listening session.
-   `id`: UUID (PK)
-   `code`: String (Unique, 6-char join code)
-   `name`: String
-   `hostId`: String (FK -> User)
-   `isPlaying`: Boolean (Current playback state)
-   `currentTrackId`: String? (ID of the playing track)
-   `position`: Int (Current seek position in ms)
-   `updatedAt`: DateTime
-   *Relations*: `members`, `queue`

### `RoomMember`
Link table for Users in Rooms.
-   `id`: UUID (PK)
-   `userId`: String? (FK -> User, nullable for guests)
-   `roomId`: String (FK -> Room)
-   `joinedAt`: DateTime

### `Track`
Cached metadata for a song.
-   `id`: UUID (PK)
-   `pipedId`: String (Unique, YouTube Video ID)
-   `title`: String
-   `artist`: String
-   `album`: String?
-   `thumbnailUrl`: String?
-   `duration`: Int (Seconds)

### `RoomQueue`
Ordered list of tracks in a room.
-   `id`: UUID (PK)
-   `roomId`: String (FK -> Room)
-   `trackId`: String (FK -> Track)
-   `order`: Int (Sort order)
-   `addedBy`: String? (UserId)
-   `isPlayed`: Boolean (True if in History, False if Up Next)

### `Playlist` & `PlaylistTrack`
User-created collections.
-   Standard one-to-many relation for playlists and many-to-many for tracks within them.

### `LikedTrack`
User's "Liked Songs" library.
-   Composite Unique Key: `[userId, trackId]`

---

## Redis Data Store (Caching)

We use Redis to cache transient data and API responses to improve performance.

| Key Pattern | TTL | Description |
| :--- | :--- | :--- |
| `search:{query}` | 1 Hour | Results for a specific search query. |
| `trending` | 2 Hours | Global trending music list. |
| `recommendations:{videoId}:v2` | 1 Hour | Smart recommendations for a seed track. |
| `home:shelves` | 1 Hour | Aggregated data for the Home page shelves. |
