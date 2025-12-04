const YTMusic = require('ytmusic-api');

const run = async () => {
    const ytmusic = new YTMusic();
    await ytmusic.initialize();

    try {
        console.log("YTMusic methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(ytmusic)));

        // Inspect Playlist Structure
        try {
            const playlist = await ytmusic.getPlaylist('PL4fGSI1pDJn69On1f-8NAvX_CYlx7QyZc');
            console.log("Playlist Keys:", Object.keys(playlist));
            if (playlist.content) console.log("Content Type:", Array.isArray(playlist.content) ? "Array" : typeof playlist.content);
            // Check if tracks are in 'tracks' or 'items'
            // console.log("Full Playlist:", JSON.stringify(playlist, null, 2).substring(0, 500));
        } catch (err) {
            console.log("getPlaylist failed:", err.message);
        }

        // Test getHomeSections with Region
        try {
            console.log("Fetching Home Sections for IN (India)...");
            const ytmusicIN = new YTMusic();
            await ytmusicIN.initialize({ gl: 'IN', hl: 'en' });
            const homeIN = await ytmusicIN.getHomeSections();

            const trendingSection = homeIN.find(s => s.title.includes('Top') || s.title.includes('Trending'));
            const newReleasesSection = homeIN.find(s => s.title.includes('New'));

            if (trendingSection && trendingSection.contents) {
                console.log("Trending Item 0:", JSON.stringify(trendingSection.contents[0], null, 2));
            }
            if (newReleasesSection && newReleasesSection.contents) {
                console.log("New Release Item 0:", JSON.stringify(newReleasesSection.contents[0], null, 2));
            }

        } catch (err) {
            console.log("getHomeSections (IN) failed:", err.message);
        }
    } catch (e) {
        console.error("Error fetching charts:", e);
    }
};

run();
