const YTMusic = require('ytmusic-api');
const ytmusic = new YTMusic();

(async () => {
    await ytmusic.initialize();

    const query = "Shape of You";
    const searchResults = await ytmusic.search(query);
    const firstResult = searchResults[0];

    console.log("First Result:", firstResult);

    if (firstResult && firstResult.videoId) {
        console.log("\n--- Testing getUpNext / Watch Playlist logic ---");
        // Note: ytmusic-api might not have getWatchPlaylist. Checking available methods.
        // If not, we might have to rely on search or getArtist.

        try {
            // Attempting to find related content
            // Some libraries have getNext(videoId)
            if (ytmusic.getNext) {
                const next = await ytmusic.getNext(firstResult.videoId);
                console.log("getNext result:", next);
            } else {
                console.log("getNext method not found.");
            }

            if (ytmusic.getWatchPlaylist) {
                const watch = await ytmusic.getWatchPlaylist(firstResult.videoId);
                console.log("getWatchPlaylist result:", watch);
            } else {
                console.log("getWatchPlaylist method not found.");
            }

        } catch (e) {
            console.error("Error fetching related:", e);
        }
    }
})();
