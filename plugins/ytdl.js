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
    const chatId = m.chat || m.key.remoteJid;
    const query = args.join(' ').trim();

    if (!query) {
        return sock.sendMessage(chatId, { 
            text: '❌ *𝗣𝗹𝗲𝗮𝘀𝗲 𝗽𝗿𝗼𝘃𝗶𝗱𝗲 𝗮 𝘀𝗼𝗻𝗴 𝗻𝗮𝗺𝗲!*\n*𝗨𝘀𝗮𝗴𝗲:* .play <song name>' 
        }, { quoted: m });
    }

    try {
        await sock.sendMessage(chatId, { text: '⚡ 𝗣𝗢𝗣𝗞𝗜𝗗 𝗕𝗢𝗧 _Searching for your song..._' }, { quoted: m });

        const { videos } = await yts(query);

        if (!videos?.length) {
            return sock.sendMessage(chatId, { text: '❌ *𝗡𝗼 𝗿𝗲𝘀𝘂𝗹𝘁𝘀 𝗳𝗼𝘂𝗻𝗱!*' }, { quoted: m });
        }

        const video = videos[0];

        const promptText = `
╔═ 🎵 𝗣𝗢𝗣𝗞𝗜𝗗 𝗠𝗨𝗦𝗜𝗖 ═╗
║ 🎶 𝗧𝗶𝘁𝗹𝗲: ${video.title}
║ 👤 𝗦𝗶𝗻𝗴𝗲𝗿: ${video.author.name}
║ ⏱️ 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻: ${video.timestamp}
║ 👁️ 𝗩𝗶𝗲𝘄𝘀: ${video.views ? video.views.toLocaleString() : 'N/A'}
║ 🔗 𝗨𝗿𝗹: ${video.url}
╠═══════════════════╣
║ 𝗥𝗲𝗽𝗹𝘆 𝘄𝗶𝘁𝗵 𝗮 𝗻𝘂𝗺𝗯𝗲𝗿:
║
║ 1️⃣ 𝗔𝘂𝗱𝗶𝗼 (.mp3)
║ 2️⃣ 𝗗𝗼𝗰𝘂𝗺𝗲𝗻𝘁 / 𝗙𝗶𝗹𝗲
║ 3️⃣ 𝗩𝗼𝗶𝗰𝗲 𝗡𝗼𝘁𝗲 (.ptt)
╚═══════════════════╝
> ⏱️ *𝗥𝗲𝗽𝗹𝘆 𝘄𝗶𝘁𝗵 1, 2, 𝗼𝗿 3 𝘄𝗶𝘁𝗵𝗶𝗻 20 𝘀𝗲𝗰𝗼𝗻𝗱𝘀!*
`.trim();

        const sentMsg = await sock.sendMessage(chatId, { text: promptText }, { quoted: m });

        // Reliable response collector
        let userChoice = '1'; // Default choice
        
        try {
            userChoice = await new Promise((resolve) => {
                const timer = setTimeout(() => {
                    sock.ev.off('messages.upsert', listener);
                    resolve('1');
                }, 20000);

                const listener = (chatUpdate) => {
                    for (const msg of chatUpdate.messages) {
                        if (!msg.message) continue;
                        
                        const msgJid = msg.key.remoteJid;
                        const sender = msg.key.participant || msg.key.remoteJid;
                        const targetSender = m.key.participant || m.key.remoteJid;

                        if (msgJid === chatId && sender === targetSender) {
                            const text = (
                                msg.message.conversation || 
                                msg.message.extendedTextMessage?.text || 
                                ''
                            ).trim();

                            if (['1', '2', '3'].includes(text)) {
                                clearTimeout(timer);
                                sock.ev.off('messages.upsert', listener);
                                resolve(text);
                                break;
                            }
                        }
                    }
                };

                sock.ev.on('messages.upsert', listener);
            });
        } catch {
            userChoice = '1';
        }

        await sock.sendMessage(chatId, { text: '⏳ *𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗶𝗻𝗴 𝘆𝗼𝘂𝗿 𝘀𝗼𝗻𝗴...*' }, { quoted: m });

        const songData = await downloadWithRetry(video.url);

        let thumbnailBuffer;
        try {
            const img = await axios.get(songData.thumbnail, { responseType: 'arraybuffer', timeout: 15000 });
            thumbnailBuffer = Buffer.from(img.data);
        } catch {
            // thumbnail fallback
        }

        // Option 2: Document File
        if (userChoice === '2') {
            await sock.sendMessage(chatId, {
                document: { url: songData.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${songData.title}.mp3`,
                caption: `🎵 *${songData.title}*`
            }, { quoted: m });

        // Option 3: Voice Note
        } else if (userChoice === '3') {
            await sock.sendMessage(chatId, {
                audio: { url: songData.downloadUrl },
                mimetype: 'audio/mp4',
                ptt: true
            }, { quoted: m });

        // Option 1: Standard Audio
        } else {
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
        }

    } catch (err) {
        console.error('Play error:', err.message);
        const reason =
            err.response?.status === 408 ? 'Download timed out. Try again in a moment.' :
            err.response?.status === 429 ? 'Rate limited. Wait a minute.' :
            err.message;
        await sock.sendMessage(chatId, { text: `❌ *𝗙𝗮𝗶𝗹𝗲𝗱:* ${reason}` }, { quoted: m });
    }
});
