
import { PrismaClient } from '@prisma/client';
import { ytmusic } from '../src/services/ytmusic';

const prisma = new PrismaClient();

const fixDurations = async () => {
    console.log('Starting duration fix script...');

    // Find all tracks with 0 duration
    const tracks = await prisma.track.findMany({
        where: { duration: 0 }
    });

    console.log(`Found ${tracks.length} tracks with 0 duration.`);

    for (const track of tracks) {
        try {
            console.log(`Fetching duration for: ${track.title} (${track.pipedId})`);
            const song: any = await ytmusic.getSong(track.pipedId);

            if (song && song.duration) {
                await prisma.track.update({
                    where: { id: track.id },
                    data: { duration: song.duration }
                });
                console.log(`Updated duration to ${song.duration}s`);
            } else {
                console.warn(`Could not find duration for ${track.pipedId}`);
            }

            // Rate limit slightly
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            console.error(`Failed to update ${track.pipedId}:`, e);
        }
    }

    console.log('Duration fix complete.');
    await prisma.$disconnect();
};

fixDurations();
