const YTMusic = require('ytmusic-api');
const API = YTMusic.default || YTMusic;

async function main() {
    const ytmusic = new API();
    await ytmusic.initialize();

    // Sidhu Moosewala
    const artistId = 'UCIOXXUXQ8y5ivei97JkiBAw';
    const artistName = 'sidhu moose wala';

    console.log(`Verifying collab detection for ${artistId}...`);

    // Test Case: Old Skool (Album: MPREb_PG9BCfFYjob)
    // Artist: Prem Dhillon, Sidhu Moose Wala, & Naseeb
    // Song: Old Skool

    try {
        const album = await ytmusic.getAlbum('MPREb_PG9BCfFYjob');
        const song = album.songs[0];

        console.log('--- TEST CASE: Old Skool ---');
        console.log('Album Artist:', album.artist.name);
        console.log('Song Artist:', song.artist.name);
        console.log('Song Name:', song.name);

        const albumArtistName = album.artist.name.toLowerCase();
        const isTrustedAlbum = album.artist.artistId === artistId ||
            albumArtistName.includes(artistName) ||
            artistName.includes(albumArtistName);

        console.log('isTrustedAlbum:', isTrustedAlbum); // Should be TRUE because "sidhu moose wala" is in "prem dhillon, sidhu moose wala..."

        if (!isTrustedAlbum) {
            const songArtistName = song.artist.name.toLowerCase();
            const songName = song.name.toLowerCase();
            const titleMatch = songName.includes(artistName);
            console.log('Title Match:', titleMatch);
        }

    } catch (e) {
        console.error('Failed:', e);
    }
}

main();
