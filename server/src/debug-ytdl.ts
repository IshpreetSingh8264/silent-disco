import ytdl from '@distube/ytdl-core';
import fs from 'fs';

const videoId = 'kIft-LUHHVA'; // Espresso
const url = `https://www.youtube.com/watch?v=${videoId}`;

async function test() {
    console.log('Testing ytdl.getInfo...');
    try {
        const info = await ytdl.getInfo(url);
        console.log('getInfo success:', info.videoDetails.title);

        console.log('Testing stream...');
        const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });

        stream.on('response', (res) => {
            console.log('Stream response status:', res.statusCode);
        });

        stream.on('error', (err) => {
            console.error('Stream error:', err);
        });

        stream.pipe(fs.createWriteStream('test.mp3'));
        console.log('Stream piped to test.mp3');
    } catch (err) {
        console.error('Global error:', err);
    }
}

test();
