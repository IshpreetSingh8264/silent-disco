
import { YTMusic } from 'ytmusic-api';

const run = async () => {
    const ytmusic = new YTMusic();
    await ytmusic.initialize();

    console.log('Searching for "Sidhu"...');
    const results = await ytmusic.search('Sidhu');

    console.log('--- Raw Results Summary ---');
    results.forEach((item: any, index) => {
        console.log(`[${index}] Type: ${item.type}, Name: ${item.name || item.title}`);
        if (item.type === 'ARTIST') {
            console.log('  -> ARTIST FOUND:', JSON.stringify(item, null, 2));
        }
        if (item.type === 'PLAYLIST') {
            console.log('  -> PLAYLIST FOUND:', JSON.stringify(item, null, 2));
        }
    });
};

run();
