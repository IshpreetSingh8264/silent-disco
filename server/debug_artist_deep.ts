import YTMusic from 'ytmusic-api';

async function main() {
    const ytmusic = new YTMusic();
    await ytmusic.initialize();

    // Karan Aujla ID
    const artistId = 'UC3XBkDeCVXCoCofFgfUZXGw';

    console.log(`Fetching artist data for ${artistId}...`);
    try {
        const artist: any = await ytmusic.getArtist(artistId);
        console.log('--- Artist Metadata ---');
        console.log('Name:', artist.name);

        if (artist.similarArtists) {
            console.log('--- Similar Artists (First 2) ---');
            console.log(JSON.stringify(artist.similarArtists.slice(0, 2), null, 2));
        }

        if (artist.featuredOn) {
            console.log('--- Featured On (First 2) ---');
            console.log(JSON.stringify(artist.featuredOn.slice(0, 2), null, 2));
        }

        console.log('--- Albums (getArtistAlbums) ---');
        const albums = await ytmusic.getArtistAlbums(artistId);
        if (albums.length > 0) {
            console.log('First Album:', JSON.stringify(albums[0], null, 2));
        }

        console.log('--- Songs (getArtistSongs) ---');
        const songs = await ytmusic.getArtistSongs(artistId);
        if (songs.length > 0) {
            console.log('First Song:', JSON.stringify(songs[0], null, 2));
            console.log('Song Artists:', JSON.stringify(songs[0].artists, null, 2));
        }

    } catch (e) {
        console.error('Failed:', e);
    }
}

main();
