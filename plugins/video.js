const axios = require('axios');
const yts = require('yt-search');

const DL_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const API_KEY = 'qasim-dev';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function downloadWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await axios.get(DL_API, {
                params: { apiKey: API_KEY, format: '360', url },
                timeout: 120000
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
    name: 'video',
    category: 'Downloaders',
    aliases: ['ytmp4', 'ytvideo'],
    description: 'Download YouTube videos by link or search',
    command: /^\.?(video|ytmp4|ytvideo)\b/i,

    async execute(sock, m, args) {
        const query = args.join(' ').trim();

        if (!query) {
            return m.reply('🎥 *What video do you want to download?*\nExample:\n.video Alan Walker Faded');
        }

        try {
            let videoUrl, videoTitle, videoThumbnail;

            if (query.startsWith('http://') || query.startsWith('https://')) {
                videoUrl = query;
            } else {
                const { videos } = await yts(query);
                if (!videos?.length) {
                    return m.reply('❌ No videos found!');
                }
                videoUrl = videos[0].url;
                videoTitle = videos[0].title;
                videoThumbnail = videos[0].thumbnail;
            }

            const validYT = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
            if (!validYT) {
                return m.reply('❌ Not a valid YouTube link!');
            }

            const ytId = validYT[1];
            const thumb = videoThumbnail || `https://i.ytimg.com/vi/${ytId}/sddefault.jpg`;

            await m.reply({
                image: { url: thumb },
                caption: `🎬 *${videoTitle || query}*\n⬇️ Downloading... *(may take up to 30s)*`
            });

            const videoData = await downloadWithRetry(videoUrl);

            await m.reply({
                video: { url: videoData.downloadUrl },
                mimetype: 'video/mp4',
                fileName: `${videoData.title || videoTitle || 'video'}.mp4`,
                caption: `🎬 *${videoData.title || videoTitle || 'Video'}*\n\n> *_Downloaded by popkid_*`
            });

        } catch (err) {
            console.error('[VIDEO] Error:', err.message);
            const reason = err.response?.status === 408
                ? 'Download timed out. Try again.'
                : err.message;
            await m.reply(`❌ Download failed!\nReason: ${reason}`);
        }
    }
};
