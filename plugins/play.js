const axios = require('axios');

// ────────────────────────────────
// Config
// ────────────────────────────────
const DL_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const API_KEY = 'qasim-dev';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const REQUEST_TIMEOUT_MS = 90000;
const THUMB_TIMEOUT_MS = 15000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// yt-search ships as ESM in newer versions, which breaks a plain require()
// in a CommonJS project. Loading it lazily via dynamic import() works
// either way (CJS or ESM) without needing "type": "module" in package.json.
let ytsPromise;
function getYts() {
    if (!ytsPromise) {
        ytsPromise = import('yt-search').then((mod) => mod.default || mod);
    }
    return ytsPromise;
}

async function downloadWithRetry(url, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await axios.get(DL_API, {
                params: { apiKey: API_KEY, format: 'mp3', url },
                timeout: REQUEST_TIMEOUT_MS
            });
            if (data?.data?.downloadUrl) return data.data;
            throw new Error('No download URL');
        } catch (err) {
            if (i === retries - 1) throw err;
            console.log(`Download attempt ${i + 1} failed, retrying in 5s...`);
            await wait(RETRY_DELAY_MS);
        }
    }
    throw new Error('All download attempts failed');
}

/**
 * Pull the query text out of the incoming message object.
 * Tries the common shapes different loaders use.
 */
function extractQuery(m) {
    if (Array.isArray(m.args) && m.args.length) return m.args.join(' ').trim();
    const raw = m.text || m.body || '';
    const parts = raw.trim().split(/\s+/);
    parts.shift(); // drop the command itself (e.g. ".play")
    return parts.join(' ').trim();
}

// ────────────────────────────────
// Command
// ────────────────────────────────
module.exports = {
    name: 'play',
    category: 'music',
    aliases: ['plays', 'music'],
    description: 'Search and download a song as MP3 from YouTube',
    usage: '.play <song name>',

    async execute(sock, m) {
        const chatId = m.from;
        const query = extractQuery(m);

        if (!query) {
            return sock.sendMessage(
                chatId,
                { text: '*Which song do you want to play?*\nUsage: .play <song name>' },
                { quoted: m }
            );
        }

        try {
            await sock.sendMessage(chatId, { text: '🔍 *Searching...*' }, { quoted: m });

            const yts = await getYts();
            const { videos } = await yts(query);
            if (!videos?.length) {
                return sock.sendMessage(chatId, { text: '❌ *No results found!*' }, { quoted: m });
            }
            const video = videos[0];

            await sock.sendMessage(chatId, {
                text: `✅ *Found:* ${video.title}\n⏱️ ${video.timestamp}\n👤 ${video.author.name}\n\n⏳ *Downloading... (this may take up to 30s)*`
            }, { quoted: m });

            const songData = await downloadWithRetry(video.url);

            let thumbnailBuffer;
            try {
                const img = await axios.get(songData.thumbnail, {
                    responseType: 'arraybuffer',
                    timeout: THUMB_TIMEOUT_MS
                });
                thumbnailBuffer = Buffer.from(img.data);
            } catch { /* no thumbnail */ }

            await sock.sendMessage(chatId, {
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
            }, { quoted: m });
        } catch (err) {
            console.error('Play error:', err.message);
            const reason = err.response?.status === 408
                ? 'Download timed out. Try again in a moment.'
                : err.response?.status === 429
                    ? 'Rate limited. Wait a minute.'
                    : err.message;
            await sock.sendMessage(chatId, { text: `❌ *Failed:* ${reason}` }, { quoted: m });
        }
    }
};
