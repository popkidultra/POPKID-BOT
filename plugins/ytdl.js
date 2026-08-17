const yts = require('yt-search');
const axios = require('axios');

const { cmd } = require('../arslan');

const DL_API = 'https://api--shadowcorexyz.replit.app/download/ytmp3';

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

        let data;
        try {
            const res = await axios.get(DL_API, {
                params: { url: video.url },
                timeout: 60000
            });
            data = res.data;
        } catch (apiErr) {
            console.error('play: API request failed:', apiErr);
            return m.reply('❌ *Failed to reach the download API. Please try again later.*');
        }

        if (!data?.status || !data?.data?.dl) {
            console.error('play: unexpected API response shape:', JSON.stringify(data));
            return m.reply('❌ *Failed to fetch audio. Please try again later.*');
        }

        const title = data.data.title || video.title;
        const downloadURL = data.data.dl;

        try {
            await sock.sendMessage(m.from, {
                audio: { url: downloadURL },
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`
            }, { quoted: m });
        } catch (sendErr) {
            console.error('play: sendMessage failed:', sendErr);
            return m.reply('❌ *Downloaded the audio but failed to send it. Try again.*');
        }

    } catch (err) {
        console.error('play error:', err);
        const reason =
            err.response?.status === 408 ? 'Download timed out. Try again in a moment.' :
            err.response?.status === 429 ? 'Rate limited. Wait a minute.' :
            err.message;
        m.reply(`❌ *Failed:* ${reason}`);
    }
});
