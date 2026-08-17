const yts = require('yt-search');
const axios = require('axios');

const { cmd } = require('../arslan');

cmd({
    pattern: "play2",
    name: 'play2',
    category: 'Downloaders',
    aliases: ['song2'],
    description: 'Search and download a song as MP3 (alternate API)',
    filename: __filename
}, async (sock, m, args) => {
    const query = args.join(' ').trim();

    if (!query) {
        return m.reply('*What song do you want to download?*\nUsage: .play2 <song name>');
    }

    try {
        const { videos } = await yts(query);

        if (!videos?.length) {
            return m.reply('*No songs found!*');
        }

        const video = videos[0];

        await m.reply('*Please wait, your download is in progress...*');

        const { data } = await axios.get('https://apis-keith.vercel.app/download/dlmp3', {
            params: { url: video.url },
            timeout: 60000
        });

        if (!data?.status || !data?.result?.downloadUrl) {
            return m.reply('*Failed to fetch audio from the API. Please try again later.*');
        }

        const { downloadUrl, title } = data.result;

        await sock.sendMessage(m.from, {
            audio: { url: downloadUrl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`
        }, { quoted: m });

    } catch (err) {
        console.error('play2 error:', err.message);
        m.reply('*Download failed. Please try again later.*');
    }
});
