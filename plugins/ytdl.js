const yts = require('yt-search');
const axios = require('axios');

const DL_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const API_KEY = 'qasim-dev';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function downloadWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await axios.get(DL_API, {
                params: { apiKey: API_KEY, format: 'mp3', url },
                timeout: 90000
            });
            if (data?.data?.downloadUrl) return data.data;
            throw new Error('No download URL');
        } catch (err) {
            if (i === retries - 1) throw err;
            console.log(`Download attempt ${i + 1} failed, retrying in 5s...`);
            await wait(5000);
        }
    }
    throw new Error('All download attempts failed');
}

module.exports = {
    name: 'play',
    category: 'Downloaders',
    aliases: ['plays', 'music', 'song'],
    description: 'Search and download a song as MP3 from YouTube',
    command: /^\.?(play|plays|music|song)\b/i,

    async execute(sock, m, args) {
        const query = args.join(' ').trim();

        if (!query) {
            return m.reply('*Which song do you want to play?*\nUsage: .play <song name>');
        }

        try {
            await m.reply('🔍 *Searching...*');

            const { videos } = await yts(query);

            if (!videos?.length) {
                return m.reply('❌ *No results found!*');
            }

            const video = videos[0];

            await m.reply(`✅ *Found:* ${video.title}\n⏱️ ${video.timestamp}\n👤 ${video.author.name}\n\n⏳ *Downloading... (this may take up to 30s)*`);

            const songData = await downloadWithRetry(video.url);

            let thumbnailBuffer;
            try {
                const img = await axios.get(songData.thumbnail, { responseType: 'arraybuffer', timeout: 15000 });
                thumbnailBuffer = Buffer.from(img.data);
            } catch {
                // no thumbnail available, not fatal
            }

            await m.reply({
                audio: { url: songData.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${songData.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: songData.title,
                        body: `${video.author.name} • ${video.timestamp}`,
                        thumbnail: thumbnailBuffer,
                        mediaType: 2,
                        sourceUrl: video.url
                    }
                }
            });

        } catch (err) {
            console.error('Play error:', err.message);
            const reason =
                err.response?.status === 408 ? 'Download timed out. Try again in a moment.' :
                err.response?.status === 429 ? 'Rate limited. Wait a minute.' :
                err.message;
            await m.reply(`❌ *Failed:* ${reason}`);
        }
    }
};
