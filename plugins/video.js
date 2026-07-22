module.exports = {
    name: 'video',
    category: 'Downloaders',
    aliases: ['vid', 'ytvideo'],
    description: 'Search YouTube and send the video',
    command: /^\.?(video|vid|ytvideo)/i,

    async execute(sock, m, args) {
        try {
            const query = args.join(' ').trim();

            if (!query) {
                return m.reply('Usage: .video <search query>\nExample: .video faded alan walker');
            }

            // 1. Search for the video using the exact API provided
            const searchUrl = `https://api.deline.web.id/search/youtube?q=${encodeURIComponent(query)}&apikey=agasamel`;
            const searchRes = await fetch(searchUrl);

            if (!searchRes.ok) {
                return m.reply(`❌ Search failed (HTTP ${searchRes.status}). API may be down.`);
            }

            const searchData = await searchRes.json();
            if (!searchData.status || !Array.isArray(searchData.result) || searchData.result.length === 0) {
                return m.reply(`No results found for "${query}".`);
            }

            const video = searchData.result[0];
            const title = video.title || 'Unknown title';
            const youtubeLink = video.link;

            if (!youtubeLink) {
                return m.reply('❌ Could not extract video link from search result.');
            }

            // 2. Let the user know we're downloading
            await m.reply(`⏳ Downloading *${title}*...`);

            // 3. Use a YouTube downloader API to get a direct MP4 link
            //    This endpoint should return a direct video URL.
            const downloadUrl = `https://api.deline.web.id/downloader/ytmp4?url=${encodeURIComponent(youtubeLink)}&apikey=agasamel`;
            const dlRes = await fetch(downloadUrl);

            if (!dlRes.ok) {
                return m.reply(`❌ Download failed (HTTP ${dlRes.status}). The video might be too long or blocked.`);
            }

            const dlData = await dlRes.json();

            // Handle various possible response structures
            const directVideoLink =
                dlData.result?.download?.url ||
                dlData.result?.download ||
                dlData.download ||
                dlData.url ||
                dlData.link;

            if (!directVideoLink) {
                return m.reply('❌ Failed to get a direct video download link. The video may be too long or unavailable.');
            }

            // 4. Build caption with video details
            const caption =
                `🎬 *${title}*\n` +
                `📺 Channel: ${video.channel || 'Unknown'}\n` +
                `⏱ Duration: ${video.duration || 'N/A'}\n` +
                `📌 Source: ${youtubeLink}\n\n` +
                `© popkid`;

            // 5. Send the video as a native WhatsApp video message
            await sock.sendMessage(m.from, {
                video: { url: directVideoLink },
                caption,
                mimetype: 'video/mp4'
            });

        } catch (err) {
            console.error('Video command error:', err);
            m.reply('❌ Failed to download or send the video. Please try again later.');
        }
    }
};
