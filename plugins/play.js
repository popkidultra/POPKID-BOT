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
    category: 'Media',
    aliases: ['song', 'ytmp3', 'music'],
    description: 'Search and download songs from YouTube',

    async execute(sock, m, args) {
        const query = args.join(' ');
        if (!query) {
            return await sock.sendMessage(m.from, { 
                text: '❌ *Please provide a song name or YouTube link!*\n\n*Example:* `.play Jony Kamin`',
                ...newsletterContext 
            });
        }

        // --- 1. Send initial status message ---
        const loadingMsg = await m.reply('🔍 *Searching for track...*');

        try {
            // --- 2. Search YouTube ---
            const searchResult = await yts(query);
            const video = searchResult.videos[0];

            if (!video) {
                return await sock.sendMessage(m.from, {
                    text: '❌ *No video found for your query.*',
                    edit: loadingMsg.key,
                    ...newsletterContext
                });
            }

            // --- 3. Update status: Fetching download URL ---
            await sock.sendMessage(m.from, {
                text: `🎵 *Found:* ${video.title}\n⏳ *Fetching audio data...*`,
                edit: loadingMsg.key,
                ...newsletterContext
            });

            // --- 4. Call API Endpoint ---
            const apiUrl = `https://jerrycoder.oggyapi.workers.dev/down/ytmp3?url=${encodeURIComponent(video.url)}`;
            const response = await axios.get(apiUrl);
            const data = response.data;

            if (!data || data.status !== 'success' || !data.url) {
                throw new Error('Failed to fetch valid download link from API.');
            }

            // --- 5. Format Info Message ---
            const caption = 
`🎶 *POPKID XMD MUSIC PLAYER*

📌 *Title* : ${data.title || video.title}
⏱️ *Duration* : ${video.timestamp || 'N/A'}
🎚️ *Quality* : ${data.quality || '128k'}
👤 *Channel* : ${video.author ? video.author.name : 'Unknown'}
🔗 *URL* : ${video.url}

*Choose output option below:*
1️⃣ Reply *1* for **Audio** (Standard MP3)
2️⃣ Reply *2* for **Voice Note** (PTT Audio)
3️⃣ Reply *3* for **Document File** (.mp3 file)`;

            // --- 6. Send Video Thumbnail with Details & Options ---
            await sock.sendMessage(m.from, {
                image: { url: video.thumbnail },
                caption: caption,
                ...newsletterContext
            });

            // Clean up the initial loading message
            try {
                await sock.sendMessage(m.from, { delete: loadingMsg.key });
            } catch (e) {
                // Ignore if deletion fails
            }

            // --- 7. Auto-Send Standard Audio Default ---
            // Sends the audio directly to ensure seamless playback without requiring strict reply handlers
            await sock.sendMessage(m.from, {
                audio: { url: data.url },
                mimetype: 'audio/mp4',
                fileName: `${data.title}.mp3`,
                ...newsletterContext
            }, { quoted: m });

        } catch (err) {
            console.error('Play command error:', err);
            await sock.sendMessage(m.from, {
                text: '❌ *An error occurred while processing your request. Please try again later.*',
                edit: loadingMsg.key,
                ...newsletterContext
            }).catch(async () => {
                await sock.sendMessage(m.from, { 
                    text: '❌ *Failed to download track.*',
                    ...newsletterContext 
                });
            });
        }
    }
};
