const yts = require('yt-search');
const fetch = require('node-fetch');

module.exports = {
    name: 'video',
    category: 'Downloader',
    aliases: ['ytv', 'youtubevideo'],
    description: 'Download a YouTube video by title or query',

    async execute(sock, m, args) {
        const query = args.join(' ');
        const loadingMsg = await m.reply('🔍 Searching...');

        if (!query) {
            await sock.sendMessage(m.from, {
                text: '❌ *VIDEO ERROR*\n━━━━━━━━━━━━━━━━\nGive me a video name, it\'s not rocket science.',
                edit: loadingMsg.key
            });
            return;
        }
        if (query.length > 100) {
            await sock.sendMessage(m.from, {
                text: '❌ *VIDEO ERROR*\n━━━━━━━━━━━━━━━━\nTitle too long! Keep it under 100 characters.',
                edit: loadingMsg.key
            });
            return;
        }

        try {
            const searchQuery = `${query} official`;
            const searchResult = await yts(searchQuery);
            const video = searchResult.videos[0];

            if (!video) {
                await sock.sendMessage(m.from, {
                    text: `❌ *VIDEO ERROR*\n━━━━━━━━━━━━━━━━\nNothing found for "${query}". Try a different title.`,
                    edit: loadingMsg.key
                });
                return;
            }

            const encodedUrl = encodeURIComponent(video.url);
            const apiUrl = `https://api.ootaizumi.web.id/downloader/youtube?url=${encodedUrl}&format=720`;
            const response = await fetch(apiUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json"
                }
            });
            const data = await response.json();

            if (!data.status || !data.result || !data.result.download) {
                throw new Error('API returned no valid video data.');
            }

            const title = data.result.title || video.title || 'Untitled';
            const videoUrl = data.result.download;
            const thumbnailUrl = data.result.thumbnail || video.thumbnail;

            await sock.sendMessage(m.from, {
                text: `✅ *Sending:* ${title}`,
                edit: loadingMsg.key
            });

            await sock.sendMessage(m.from, {
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                fileName: `${title}.mp4`,
                contextInfo: {
                    externalAdReply: {
                        title: title,
                        body: 'Powered by PopKid MD',
                        thumbnailUrl: thumbnailUrl,
                        sourceUrl: video.url,
                        mediaType: 2,
                        renderLargerThumbnail: true
                    }
                }
            });

        } catch (error) {
            console.error('Video error:', error);
            let userMessage = 'Download failed. Please try again later.';
            if (error.message.includes('API returned')) {
                userMessage = 'The video service rejected the request.';
            }
            await sock.sendMessage(m.from, {
                text: `❌ *VIDEO ERROR*\n━━━━━━━━━━━━━━━━\n${userMessage}\n${error.message}`,
                edit: loadingMsg.key
            });
        }
    }
};
