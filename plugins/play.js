const yts = require('yt-search');
const axios = require('axios');
const { sendInteractiveMessage } = require('gifted-btns');

const DL_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const API_KEY = 'qasim-dev';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const downloadWithRetry = async (url, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await axios.get(DL_API, {
                params: { apiKey: API_KEY, format: 'mp3', url },
                timeout: 90000
            });
            if (data?.data?.downloadUrl) return data.data;
            throw new Error('No download URL returned');
        } catch (err) {
            if (i === retries - 1) throw err;
            await wait(5000);
        }
    }
    throw new Error('All download attempts failed.');
};

module.exports = {
    name: 'play',
    category: 'Music',
    aliases: ['song', 'music'],
    description: 'Search and download MP3 audio from YouTube.',

    async execute(sock, m, args) {
        const query = args.join(' ').trim();

        if (!query) {
            return await sock.sendMessage(m.from, { 
                text: '❌ *Please provide a song name or YouTube link!*\n\n*Usage:* `.play <song name>`' 
            }, { quoted: m });
        }

        try {
            const { videos } = await yts(query);
            if (!videos?.length) {
                return await sock.sendMessage(m.from, { text: '❌ *No results found for your query!*' }, { quoted: m });
            }

            const video = videos[0];

            // Interactive response styled like uptime.js
            await sendInteractiveMessage(sock, m.from, {
                title: '🎵 MUSIC DOWNLOADER',
                text: `*Title:* ${video.title}\n*Duration:* ${video.timestamp}\n*Channel:* ${video.author.name}\n\n⏳ *Downloading audio, please wait...*`,
                footer: 'popkid 🇬🇭',
                interactiveButtons: [
                    {
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'Watch on YouTube',
                            url: video.url
                        })
                    }
                ]
            });

            // Fetch song audio link
            const songData = await downloadWithRetry(video.url);

            // Fetch thumbnail buffer
            let thumbnailBuffer = null;
            try {
                const img = await axios.get(songData.thumbnail, { responseType: 'arraybuffer', timeout: 15000 });
                thumbnailBuffer = Buffer.from(img.data);
            } catch { /* thumbnail fallback */ }

            // Send audio message with ad metadata
            await sock.sendMessage(m.from, {
                audio: { url: songData.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${songData.title || video.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: songData.title || video.title,
                        body: `${video.author.name} • ${video.timestamp}`,
                        thumbnail: thumbnailBuffer,
                        mediaType: 2,
                        sourceUrl: video.url
                    }
                }
            }, { quoted: m });

        } catch (err) {
            console.error('Play command error:', err.message);
            const reason = err.response?.status === 408
                ? 'Download request timed out.'
                : err.response?.status === 429
                    ? 'Rate limit exceeded. Try again in a minute.'
                    : err.message;

            await sock.sendMessage(m.from, { text: `❌ *Failed to download:* ${reason}` }, { quoted: m });
        }
    }
};
