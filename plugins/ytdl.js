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

const { cmd } = require('../arslan');

cmd({
    pattern: "play",
    name: 'play',
    category: 'Downloaders',
    aliases: ['plays', 'music', 'song'],
    description: 'Search and download a song as MP3 from YouTube',
    command: /^\.?(play|plays|music|song)\b/i,
    filename: __filename
}, async (sock, m, args) => {
        const query = args.join(' ').trim();

        if (!query) {
            return m.reply('❌ *𝗣𝗹𝗲𝗮𝘀𝗲 𝗽𝗿𝗼𝘃𝗶𝗱𝗲 𝗮 𝘀𝗼𝗻𝗴 𝗻𝗮𝗺𝗲!*\n*𝗨𝘀𝗮𝗴𝗲:* .play <song name>');
        }

        try {
            await m.reply('⚡ 𝗣𝗢𝗣𝗞𝗜𝗗 𝗕𝗢𝗧 _Searching for your song..._');

            const { videos } = await yts(query);

            if (!videos?.length) {
                return m.reply('❌ *𝗡𝗼 𝗿𝗲𝘀𝘂𝗹𝘁𝘀 𝗳𝗼𝘂𝗻𝗱!*');
            }

            const video = videos[0];

            const detailsCard = `
╔═ 🎵 𝗣𝗢𝗣𝗞𝗜𝗗 𝗠𝗨𝗦𝗜𝗖 ═╗
║ 🎶 𝗧𝗶𝘁𝗹𝗲: ${video.title}
║ 👤 𝗦𝗶𝗻𝗴𝗲𝗿: ${video.author.name}
║ ⏱️ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻: ${video.timestamp}
║ 👁️ 𝗩𝗶𝗲𝘄𝘀: ${video.views ? video.views.toLocaleString() : 'N/A'}
║ 🔗 𝗨𝗿𝗹: ${video.url}
╚═══════════════════╝
> ⏳ *𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗶𝗻𝗴 𝗮𝘂𝗱𝗶𝗼, 𝗽𝗹𝗲𝗮𝘀𝗲 𝘄𝗮𝗶𝘁...*
`.trim();

            await m.reply(detailsCard);

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
            await m.reply(`❌ *𝗙𝗮𝗶𝗹𝗲𝗱:* ${reason}`);
        }
    });
