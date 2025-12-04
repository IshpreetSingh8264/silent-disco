import { PrismaClient } from '@prisma/client';
import { searchService } from '../services/search';

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to Meilisearch...');
    // Wait a bit for Meilisearch to start if running via docker-compose up
    await new Promise(resolve => setTimeout(resolve, 2000));

    await searchService.initialize();

    console.log('Fetching tracks...');
    const tracks = await prisma.track.findMany();
    console.log(`Found ${tracks.length} tracks.`);

    console.log('Indexing...');
    await searchService.indexTracks(tracks as any[]);
    console.log('Done.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
