const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    const password = await bcrypt.hash('password123', 10);

    // Create Users
    const users = [];
    for (let i = 1; i <= 5; i++) {
        const user = await prisma.user.upsert({
            where: { email: `user${i}@example.com` },
            update: {},
            create: {
                email: `user${i}@example.com`,
                username: `user${i}`,
                password,
                status: 'ACTIVE',
            },
        });
        users.push(user);
        console.log(`Created user: ${user.username}`);
    }

    // Create Tracks
    const tracks = [];
    for (let i = 1; i <= 500; i++) {
        const track = await prisma.track.upsert({
            where: { pipedId: `track-${i}` },
            update: {},
            create: {
                pipedId: `track-${i}`,
                title: `Track Title ${i}`,
                artist: `Artist ${Math.ceil(i / 10)}`,
                album: `Album ${Math.ceil(i / 20)}`,
                duration: 180 + (i % 60),
                thumbnailUrl: `https://via.placeholder.com/150?text=Track+${i}`,
                globalPlayCount: Math.floor(Math.random() * 1000),
            },
        });
        tracks.push(track);
    }
    console.log(`Created ${tracks.length} tracks.`);

    // Create Playlists
    for (const user of users) {
        await prisma.playlist.create({
            data: {
                name: `${user.username}'s Favorites`,
                userId: user.id,
                tracks: {
                    create: tracks.slice(0, 10).map((track, index) => ({
                        trackId: track.id,
                        order: index,
                    })),
                },
            },
        });
    }
    console.log('Created playlists.');

    // Create UserQueue
    const user = users[0];
    await prisma.userQueue.createMany({
        data: tracks.slice(0, 5).map((track, index) => ({
            userId: user.id,
            trackId: track.id,
            position: index * 1000.0, // float position
            source: 'MANUAL',
        })),
        skipDuplicates: true,
    });
    console.log('Created UserQueue.');

    // Create UserTrackStats
    await prisma.userTrackStats.createMany({
        data: tracks.slice(0, 20).map((track) => ({
            userId: user.id,
            trackId: track.id,
            playCount: Math.floor(Math.random() * 50),
            skipCount: Math.floor(Math.random() * 5),
            lastPlayedAt: new Date(),
        })),
        skipDuplicates: true,
    });
    console.log('Created UserTrackStats.');

    // Create ListeningHistory (Partitioned)
    // Need to ensure playedAt falls into partition ranges (2024-2026)
    const historyData = [];
    for (let i = 0; i < 50; i++) {
        historyData.push({
            userId: user.id,
            trackId: tracks[i % tracks.length].id,
            playedAt: new Date(2025, 0, 1, 12, i, 0), // Jan 1, 2025
            durationPlayed: 180,
            context: 'playlist',
        });
    }

    await prisma.listeningHistory.createMany({
        data: historyData,
    });
    console.log('Created ListeningHistory.');

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
