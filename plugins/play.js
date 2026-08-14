const axios = require('axios');
const yts = require('yt-search');

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

module.exports = {
    name: 'play',
    category: 'Music',
    aliases: ['song', 'mp3', 'ytmp3'],
    description: 'Search and play any song from YouTube',

    async execute(sock, m, args) {
        try {
            // Check if query is provided
            const text = args.join(' ');
            if (!text) {
                return await sock.sendMessage(m.from, {
                    text: '⚠️ *Please provide a song name or YouTube link!*\n\n*Example:* `.play EMIN JONY Kamin`',
                    ...newsletterContext
                }, { quoted: m });
            }

            // 1. Send searching indicator
            const loadingMsg = await sock.sendMessage(m.from, {
                text: '🔍 *Searching for the song...*',
                ...newsletterContext
            }, { quoted: m });

            let videoUrl = text;
            let videoTitle = text;
            let videoThumbnail = '';
            let videoDuration = '';

            // Check if user provided a search term instead of a direct link
            if (!text.includes('youtube.com') && !text.includes('youtu.be')) {
                const searchResults = await yts(text);
                const videos = searchResults.videos;

                if (!videos || videos.length === 0) {
                    return await sock.sendMessage(m.from, {
                        text: '❌ *No results found for your query!*',
                        edit: loadingMsg.key,
                        ...newsletterContext
                    });
                }

                const topResult = videos[0];
                videoUrl = topResult.url;
                videoTitle = topResult.title;
                videoThumbnail = topResult.thumbnail;
                videoDuration = topResult.timestamp;
            }

            // 2. Update status to Downloading
            await sock.sendMessage(m.from, {
                text: `🎵 *Song Found!*\n\n📌 *Title:* ${videoTitle}\n⏱️ *Duration:* ${videoDuration || 'Unknown'}\n\n⏳ *Fetching audio from server...*`,
                edit: loadingMsg.key,
                ...newsletterContext
            });

            // 3. Call your JerryCoder API endpoint
            const apiUrl = `https://jerrycoder.oggyapi.workers.dev/down/ytmp3?url=${encodeURIComponent(videoUrl)}`;
            const { data } = await axios.get(apiUrl, {
                headers: { 'User-Agent': 'POPKID-BOT' },
                timeout: 30000 // 30 seconds timeout
            });

            if (!data || data.status !== 'success' || !data.url) {
                return await sock.sendMessage(m.from, {
                    text: '❌ *Failed to download audio. Please try another song.*',
                    edit: loadingMsg.key,
                    ...newsletterContext
                });
            }

            // 4. Update status: Uploading Audio
            await sock.sendMessage(m.from, {
                text: '🚀 *Sending audio file...*',
                edit: loadingMsg.key,
                ...newsletterContext
            });

            // 5. Send Audio File
            await sock.sendMessage(m.from, {
                audio: { url: data.url },
                mimetype: 'audio/mp4',
                fileName: `${data.title || videoTitle}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: data.title || videoTitle,
                        body: 'POPKID XMD AUDIO PLAYER',
                        mediaType: 1,
                        thumbnailUrl: videoThumbnail || 'https://i.imgur.com/2A48MvW.jpeg',
                        sourceUrl: videoUrl,
                        renderLargerThumbnail: true
                    },
                    ...newsletterContext.contextInfo
                }
            }, { quoted: m });

        } catch (err) {
            console.error('Play command error:', err);
            await sock.sendMessage(m.from, {
                text: `❌ *An error occurred:* ${err.message || 'Unable to process audio request.'}`,
                ...newsletterContext
            }, { quoted: m });
        }
    }
};
