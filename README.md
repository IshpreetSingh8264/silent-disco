# Silent Disco 🎧

**Silent Disco** is a retro-themed, collaborative music streaming platform that brings the "listening party" experience to the web. Built with a "Shared Immersion" philosophy, it allows users to listen together in real-time, synchronized across all devices.

![Silent Disco Banner](https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=2070&auto=format&fit=crop)

## 🚀 Features

-   **Virtual Rooms**: Create or join rooms with a unique code for synchronized listening.
-   **Smart Queue**: An intelligent "infinite playback" system that keeps the music going with context-aware recommendations (Artist + Title mixing).
-   **YouTube Music Experience**:
    -   **Dynamic Shelves**: "Quick Picks", "Trending", "New Releases" on the home page.
    -   **Immersive Player**: Split-screen view with "Up Next", "Lyrics", and "Related" tabs.
-   **Premium Retro UI**: A glassmorphism-heavy, dark-mode aesthetic inspired by Cyberpunk and Retro styles.
-   **Real-Time Sync**: Socket.IO ensures play/pause, seek, and queue updates happen instantly for everyone.

## 🛠️ Tech Stack

-   **Frontend**: React, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion.
-   **Backend**: Node.js, Fastify, Socket.IO.
-   **Database**: PostgreSQL (Prisma ORM), Redis (Caching).
-   **Music Source**: `ytmusic-api` & `yt-dlp` (No official API keys required).

## 📚 Documentation

Detailed documentation is available in the `docs/` folder:

-   [**Overview & Ideology**](docs/overview.md): Our vision and high-level architecture.
-   [**Technical Details**](docs/technical_details.md): Deep dive into the Smart Queue, Recommendation Engine, and Sync logic.
-   [**Database Schema**](docs/database_schema.md): Full PostgreSQL schema and Redis key patterns.

## ⚡ Getting Started

### Prerequisites

-   Node.js 18+
-   Docker & Docker Compose (for DBs)
-   `yt-dlp` (installed on system or via bin script)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/silent-disco.git
    cd silent-disco
    ```

2.  **Start Infrastructure (Postgres & Redis)**
    ```bash
    docker-compose up -d
    ```

3.  **Install Dependencies**
    ```bash
    # Server
    cd server
    npm install
    npx prisma generate
    npx prisma db push

    # Client
    cd ../client
    npm install
    ```

4.  **Run Development Servers**
    ```bash
    # Terminal 1 (Server)
    cd server
    npm run dev

    # Terminal 2 (Client)
    cd client
    npm run dev
    ```

## 🤝 Contributing

Contributions are welcome! Please read our [Technical Details](docs/technical_details.md) before submitting a PR.

## 📄 License

MIT
