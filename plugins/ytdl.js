const yts = require('yt-search');
const axios = require('axios');

const { cmd } = require('../arslan');

const DL_API = 'https://eliteprotech-apis.zone.id/ytdown';

cmd({
    pattern: "play",
    name: 'play',
    category: 'Downloaders',
    aliases: ['plays', 'music', 'song'],
    description: 'Search and download a song as MP3 from YouTube',
    filename: __filename
}, async (sock, m, args) => {
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

        await m.reply(`✅ *Found:* ${video.title}\n⏱️ ${video.timestamp}\n👤 ${video.author.name}\n\n⏳ *Downloading...*`);

        const { data } = await axios.get(DL_API, {
            params: { url: video.url, format: 'mp3' },
            timeout: 60000
        });

        if (!data?.success || !data?.downloadURL) {
            return m.reply('❌ *Failed to fetch audio. Please try again later.*');
        }

        const title = data.title || video.title;

        await sock.sendMessage(m.from, {
            audio: { url: data.downloadURL },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            contextInfo: {
                externalAdReply: {
                    title: title,
                    body: `${video.author.name} • ${video.timestamp}`,
                    thumbnail: undefined,
                    mediaType: 2,
                    sourceUrl: video.url
                }
            }
        }, { quoted: m });

    } catch (err) {
        console.error('play error:', err.message);
        const reason =
            err.response?.status === 408 ? 'Download timed out. Try again in a moment.' :
            err.response?.status === 429 ? 'Rate limited. Wait a minute.' :
            err.message;
        m.reply(`❌ *Failed:* ${reason}`);
    }
});
