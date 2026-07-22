module.exports = {
    name: 'video',
    category: 'Downloaders',
    aliases: ['vid', 'ytvideo'],
    description: 'Search YouTube and send the video directly',
    command: /^\.?(video|vid|ytvideo)/i,

    async execute(sock, m, args) {
        try {
            const query = args.join(' ').trim();

            if (!query) {
                return m.reply('Usage: .video <search query>\nExample: .video faded alan walker');
            }

            // 1. Search for the video
            const searchUrl = `https://api.deline.web.id/search/youtube?q=${encodeURIComponent(query)}&apikey=agasamel`;
            const searchRes = await fetch(searchUrl);

            if (!searchRes.ok) {
                return m.reply(`❌ Search failed (HTTP ${searchRes.status}). API may be down.`);
            }

            const searchData = await searchRes.json();
            if (searchData.status === false) {
                return m.reply(`❌ Search failed: ${searchData.message || searchData.error || 'Unknown error'}`);
            }

            const rawList = searchData.result ?? searchData.results ?? searchData.data ?? searchData;
            const list = Array.isArray(rawList) ? rawList : rawList ? [rawList] : [];

            if (!list.length) {
                return m.reply(`No results found for "${query}".`);
            }

            const video = list[0];
            const title = video.title || video.name || 'Unknown title';
            const videoUrl = video.url || video.link || video.videoUrl ||
                (video.videoId ? `https://youtu.be/${video.videoId}` : '') ||
                (video.id ? `https://youtu.be/${video.id}` : '');

            if (!videoUrl) {
                return m.reply('❌ Could not extract video link from search results.');
            }

            // Let the user know we're processing
            await m.reply(`⏳ Downloading *${title}*...`);

            // 2. Download the video using a downloader API
            //    Using the same api.deline.web.id infrastructure (assumed endpoint).
            const downloadUrl = `https://api.deline.web.id/downloader/ytmp4?url=${encodeURIComponent(videoUrl)}&apikey=agasamel`;
            const dlRes = await fetch(downloadUrl);

            if (!dlRes.ok) {
                return m.reply(`❌ Download failed (HTTP ${dlRes.status}). Try again later.`);
            }

            const dlData = await dlRes.json();

            // The API might return different structures — try to handle them gracefully
            const directVideoLink =
                dlData.result?.download?.url ||
                dlData.result?.download ||
                dlData.download ||
                dlData.url ||
                dlData.link;

            if (!directVideoLink) {
                return m.reply('❌ Failed to get a direct video download link. The video may be too long or blocked.');
            }

            // 3. Send the video directly to WhatsApp
            const caption = `🎬 *${title}*\n⏱ Duration: ${video.duration?.timestamp || video.duration || 'N/A'}\n👁 Views: ${typeof video.views === 'number' ? video.views.toLocaleString() : video.views || 'N/A'}\n🎥 Channel: ${video.channel?.name || video.author?.name || video.channelTitle || video.uploader || 'Unknown'}\n\n© popkid`;

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
