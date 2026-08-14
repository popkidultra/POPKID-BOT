const axios = require("axios");
const yts = require("yt-search");

const newsletterContext = {
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363426778975572@newsletter',
            newsletterName: 'POPKID XMD',
            serverMessageId: 1
        }
    }
};

// Keep track of users waiting to pick a format: jid -> { result, expires, timeout }
const pending = new Map();

function formatDuration(seconds) {
    const s = Math.floor(seconds % 60);
    const m = Math.floor((seconds / 60) % 60);
    const h = Math.floor(seconds / 3600);
    return h > 0
        ? `${h}h ${m}m ${s}s`
        : `${m}m ${s}s`;
}

module.exports = {
    name: 'play',
    category: 'Downloader',
    aliases: ['song', 'yta', 'ytmp3'],
    description: 'Search/download audio from a YouTube link and choose delivery format',

    async execute(sock, m, args) {
        const query = args.join(' ').trim();

        if (!query) {
            return m.reply('❌ *Usage:* .play <YouTube link or search term>');
        }

        const loadingMsg = await m.reply('🔎 *Fetching audio, please wait...*');

        // Resolve a plain search term to a YouTube URL first
        const isUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(query);
        let videoUrl = query;

        if (!isUrl) {
            try {
                const searchResult = await yts(query);
                const video = searchResult?.videos?.[0];
                if (!video) {
                    await sock.sendMessage(m.from, {
                        text: `❌ *No results found for:* ${query}`,
                        edit: loadingMsg.key,
                        ...newsletterContext
                    });
                    return;
                }
                videoUrl = video.url;
            } catch (err) {
                console.error('play.js yt-search error:', err);
                await sock.sendMessage(m.from, {
                    text: '❌ *Search failed.* Try again or paste a direct YouTube link.',
                    edit: loadingMsg.key,
                    ...newsletterContext
                });
                return;
            }
        }

        let data;
        try {
            const apiUrl = `https://jerrycoder.oggyapi.workers.dev/down/ytmp3?url=${encodeURIComponent(videoUrl)}`;
            const { data: res } = await axios.get(apiUrl, { timeout: 30000 });

            if (!res || res.status !== 'success' || !res.url) {
                throw new Error('API returned an unsuccessful response');
            }
            data = res;
        } catch (err) {
            console.error('play.js fetch error:', err);
            try {
                await sock.sendMessage(m.from, {
                    text: '❌ *Failed to fetch audio.* The link may be invalid or the service is down.',
                    edit: loadingMsg.key,
                    ...newsletterContext
                });
            } catch (_) {
                await sock.sendMessage(m.from, { text: '❌ Failed to fetch audio.' });
            }
            return;
        }

        const durationStr = data.duration ? formatDuration(data.duration) : 'N/A';
        const caption =
`🎧 *${data.title}*

⏱️ *Duration* : ${durationStr}
🔊 *Quality*  : ${data.quality || 'N/A'}
🛠️ *Source*   : ${data.creator || 'N/A'}

Reply with a number to choose delivery format:
*1* — 🎵 Audio (music player)
*2* — 🎙️ Voice note
*3* — 📁 Document (file)

_This request expires in 60s._
_POPKID XMD_`;

        // --- Edit loading message with track info + format menu ---
        try {
            await sock.sendMessage(m.from, {
                text: caption,
                edit: loadingMsg.key,
                ...newsletterContext
            });
        } catch (err) {
            console.error('play.js edit error:', err);
            await sock.sendMessage(m.from, { text: caption, ...newsletterContext });
        }

        const senderId = m.sender || m.key.participant || m.key.remoteJid;

        // clear any previous pending request from this user
        const existing = pending.get(senderId);
        if (existing) clearTimeout(existing.timeout);

        const timeout = setTimeout(() => {
            pending.delete(senderId);
            sock.sendMessage(m.from, {
                text: '⌛ *Format selection timed out.* Run .play again.',
                ...newsletterContext
            }).catch(() => {});
        }, 60000);

        pending.set(senderId, { data, chatId: m.from, timeout });
    },

    /**
     * Call this once from your main message handler, for every incoming
     * text message (before/independent of command routing), so numeric
     * replies to the format menu get picked up:
     *
     *   const play = require('./commands/play');
     *   sock.ev.on('messages.upsert', async ({ messages }) => {
     *       for (const msg of messages) {
     *           await play.handleReply(sock, msg);
     *           // ... your normal command dispatch
     *       }
     *   });
     */
    async handleReply(sock, m) {
        const senderId = m.sender || m.key?.participant || m.key?.remoteJid;
        if (!senderId || !pending.has(senderId)) return false;

        const text = (m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            '').trim();

        if (!['1', '2', '3'].includes(text)) return false;

        const { data, chatId, timeout } = pending.get(senderId);
        clearTimeout(timeout);
        pending.delete(senderId);

        try {
            const audioResp = await axios.get(data.url, {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            const buffer = Buffer.from(audioResp.data);

            if (text === '1') {
                await sock.sendMessage(chatId, {
                    audio: buffer,
                    mimetype: 'audio/mpeg',
                    fileName: `${data.title}.mp3`,
                    ...newsletterContext
                });
            } else if (text === '2') {
                await sock.sendMessage(chatId, {
                    audio: buffer,
                    mimetype: 'audio/mpeg; codecs=opus',
                    ptt: true,
                    ...newsletterContext
                });
            } else {
                await sock.sendMessage(chatId, {
                    document: buffer,
                    mimetype: 'audio/mpeg',
                    fileName: `${data.title}.mp3`,
                    caption: `📁 *${data.title}*\n\n_POPKID XMD_`,
                    ...newsletterContext
                });
            }
        } catch (err) {
            console.error('play.js delivery error:', err);
            await sock.sendMessage(chatId, {
                text: '❌ *Failed to send audio file.* Try again later.',
                ...newsletterContext
            }).catch(() => {});
        }

        return true;
    }
};
