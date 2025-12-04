import YTMusic from 'ytmusic-api';

async function main() {
    const ytmusic = new YTMusic();
    await ytmusic.initialize();

    // Karan Aujla ID
    const artistId = 'UC3XBkDeCVXCoCofFgfUZXGw';

    console.log(`Fetching artist songs for ${artistId}...`);
    try {
        const songs = await ytmusic.getArtistSongs(artistId);
        if (songs.length > 0) {
            console.log('First song structure:', JSON.stringify(songs[0], null, 2));
            // Check for release date or year in a few songs
            songs.slice(0, 5).forEach((s: any, i) => {
                console.log(`Song ${i}: ${s.name}, Album: ${s.album?.name}, Year: ${s.year}, Release: ${s.releaseDate}`);
            });
        } else {
            console.log('No songs found.');
        }

        const albums = await ytmusic.getArtistAlbums(artistId);
        if (albums.length > 0) {
            console.log('First album structure:', JSON.stringify(albums[0], null, 2));
        }

    } catch (e) {
        console.error('Failed:', e);
    }
}

main();
