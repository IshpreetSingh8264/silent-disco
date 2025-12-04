const YTMusic = require('ytmusic-api');
const API = YTMusic.default || YTMusic;

async function main() {
    const ytmusic = new API();
    await ytmusic.initialize();

    // Test with Sidhu Moosewala
    const artistId = 'UCIOXXUXQ8y5ivei97JkiBAw';

    console.log(`Verifying strict filtering for ${artistId}...`);
    try {
        const artist = await ytmusic.getArtist(artistId);

        console.log('--- OFFICIAL DATA FROM getArtist() ---');
        console.log(`Artist: ${artist.name}`);
        console.log(`topSongs count: ${artist.topSongs?.length || 0}`);
        console.log(`topAlbums count: ${artist.topAlbums?.length || 0}`);
        console.log(`topSingles count: ${artist.topSingles?.length || 0}`);

        // Check song #100 (if it exists)
        if (artist.topSongs && artist.topSongs.length >= 100) {
            console.log('--- Song #100 ---');
            console.log(artist.topSongs[99]);
        }

        // Verify all songs have matching artist
        const badSongs = artist.topSongs?.filter(s =>
            s.artist && s.artist.name.toLowerCase() !== artist.name.toLowerCase()
        ) || [];
        console.log(`Songs with mismatched artist: ${badSongs.length}`);
        if (badSongs.length > 0) {
            console.log('First bad song:', badSongs[0]);
        }

        // Check albums
        console.log('--- Top Albums ---');
        artist.topAlbums?.forEach((a, i) => {
            console.log(`${i + 1}. ${a.name} (${a.year || 'No Year'}) - Artist: ${a.artist?.name || 'N/A'}`);
        });

    } catch (e) {
        console.error('Failed:', e);
    }
}

main();
