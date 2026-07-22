module.exports = {
    name: 'video',
    category: 'Downloaders',
    aliases: ['vid', 'ytvideo'],
    description: 'Search YouTube for a video',
    command: /^\.?(video|vid|ytvideo)/i,

    async execute(sock, m, args) {
        try {
            const query = args.join(' ').trim();

            if (!query) {
                return m.reply('Usage: .video <search query>\nExample: .video faded alan walker');
            }

            const apiUrl = `https://api.deline.web.id/search/youtube?q=${encodeURIComponent(query)}&apikey=agasamel`;

            const response = await fetch(apiUrl);

            if (!response.ok) {
                return m.reply(`❌ Video search failed (HTTP ${response.status}). The API may be down or the query invalid.`);
            }

            const data = await response.json();

            if (data.status === false) {
                return m.reply(`❌ Video search failed: ${data.message || data.error || 'Unknown error'}`);
            }

            // The exact response shape from this API wasn't confirmed live, so we
            // defensively check the common variants these "search youtube" APIs use.
            const rawList =
                data.result ??
                data.results ??
                data.data ??
                data;

            const list = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);

            if (!list.length) {
                return m.reply(`No results found for "${query}".`);
            }

            const video = list[0];

            const title = video.title || video.name || 'Unknown title';
            const url = video.url || video.link || video.videoUrl || (video.videoId ? `https://youtu.be/${video.videoId}` : '') || (video.id ? `https://youtu.be/${video.id}` : '');
            const thumbnail = video.thumbnail || video.thumb || video.image || (Array.isArray(video.thumbnails) ? video.thumbnails[0]?.url : '') || '';
            const duration = video.duration?.timestamp || video.duration || video.timestamp || 'N/A';
            const views = video.views || video.viewCount || 'N/A';
            const channel = video.channel?.name || video.author?.name || video.channelTitle || video.uploader || 'Unknown';
            const uploaded = video.uploadedAt || video.ago || video.publishedAt || '';

            const caption = `🎬 *${title}*\n` +
                `📌 Link: ${url || 'N/A'}\n` +
                `⏱ Duration: ${duration}\n` +
                `👁 Views: ${typeof views === 'number' ? views.toLocaleString() : views}\n` +
                `🎥 Channel: ${channel}` +
                (uploaded ? `\n📅 Uploaded: ${uploaded}` : '') +
                `\n\n© popkid`;

            if (thumbnail) {
                await sock.sendMessage(m.from, { image: { url: thumbnail }, caption });
            } else {
                await m.reply(caption);
            }

        } catch (err) {
            console.error('Video search error:', err);
            m.reply('❌ Failed to search for the video. Please try again later.');
        }
    }
};
