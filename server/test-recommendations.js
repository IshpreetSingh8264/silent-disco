const YTMusic = require('ytmusic-api');

async function test() {
    const ytmusic = new YTMusic();
    await ytmusic.initialize();
    console.log('Keys:', Object.keys(ytmusic));
    console.log('Proto Keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(ytmusic)));

    try {
        console.log('Testing getNext / getWatchPlaylist...');
        // Try to find a method that returns recommendations for a video
        // Common names in these wrappers: getUpNext, getWatchPlaylist, getNext

        // Let's search for a song first to get an ID
        const search = await ytmusic.search('Starboy');
        const videoId = search[0].videoId;
        console.log('Seed Video ID:', videoId);

        if (ytmusic.getUpNexts) {
            console.log('Calling getUpNexts...');
            // Need a valid videoId. 'Starboy' search might have failed or returned weird structure.
            // Let's hardcode a known ID for testing: '34Na4j8AVgA' (Starboy)
            const videoId = '34Na4j8AVgA';
            const next = await ytmusic.getUpNexts(videoId);
            console.log('getUpNexts result:', next ? 'Found' : 'Null');
            if (next) console.log(JSON.stringify(next, null, 2).substring(0, 500));
        } else {
            console.log('getUpNexts method not found');
        }

        if (ytmusic.getWatchPlaylist) {
            console.log('Calling getWatchPlaylist...');
            const wp = await ytmusic.getWatchPlaylist(videoId);
            console.log('getWatchPlaylist result:', wp ? 'Found' : 'Null');
        } else {
            console.log('getWatchPlaylist method not found');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

test();
