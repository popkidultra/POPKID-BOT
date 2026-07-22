const yts = require('yt-search');

module.exports = {
    name: 'video',
    category: 'Downloaders',
    aliases: ['vid2', 'ytmp4'],
    description: 'Search and download a YouTube video as MP4',
    command: /^\.?(video2|vid2|ytmp4)\b/i,

    async execute(sock, m, args) {
        const text = args.join(' ').trim();

        await m.react('⌛');

        if (!text) {
            await m.react('❌').catch(() => {});
            return m.reply("🎬 *VIDEO*\n━━━━━━━━━━━━━━━━\nGive me a video name, it's not rocket science.\n━━━━━━━━━━━━━━━━\n© popkid");
        }
        if (text.length > 100) {
            await m.react('❌').catch(() => {});
            return m.reply("🎬 *VIDEO*\n━━━━━━━━━━━━━━━━\nTitle longer than your attention span. Under 100 chars!\n━━━━━━━━━━━━━━━━\n© popkid");
        }

        try {
            console.log('[VIDEO2] Searching for:', text);
            const searchQuery = `${text} official`;
            const searchResult = await yts(searchQuery);
            const video = searchResult.videos[0];

            if (!video) {
                await m.react('❌').catch(() => {});
                return m.reply(`🎬 *VIDEO*\n━━━━━━━━━━━━━━━━\nNothing found for "${text}". Your taste doesn't exist.\n━━━━━━━━━━━━━━━━\n© popkid`);
            }

            console.log('[VIDEO2] Found:', video.url);

            const encodedUrl = encodeURIComponent(video.url);
            const apiUrl = `https://api.deline.web.id/downloader/youtube?url=${encodedUrl}`;
            console.log('[VIDEO2] Calling API:', apiUrl);

            const response = await fetch(apiUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json"
                }
            });

            console.log('[VIDEO2] Response status:', response.status);

            const data = await response.json();
            console.log('[VIDEO2] Full response:', JSON.stringify(data, null, 2));

            if (!data.status || !data.result) {
                throw new Error('API returned no valid data. status=' + data.status);
            }

            const result = data.result;
            const title = result.title || "Untitled";
            const thumbnailUrl = result.thumbnail;

            if (!result.medias || !result.medias.length) {
                throw new Error('No medias array in response.');
            }

            console.log('[VIDEO2] Medias count:', result.medias.length);
            console.log('[VIDEO2] Medias:', JSON.stringify(result.medias, null, 2));

            const chosen =
                result.medias.find(mformat => mformat.type === 'video' && mformat.label?.includes('720')) ||
                result.medias.find(mformat => mformat.type === 'video') ||
                result.medias[0];

            console.log('[VIDEO2] Chosen media:', JSON.stringify(chosen, null, 2));

            // Check every possible field name the API might use for the actual link
            const videoUrl = chosen.url || chosen.downloadUrl || chosen.link || chosen.download;

            if (!videoUrl) {
                throw new Error('Chosen media has no usable url field. Keys: ' + Object.keys(chosen).join(', '));
            }

            console.log('[VIDEO2] Final video URL:', videoUrl);

            await m.react('✅');
            await sock.sendMessage(m.from, {
                video: { url: videoUrl },
                mimetype: "video/mp4",
                fileName: `${title}.mp4`,
                contextInfo: {
                    externalAdReply: {
                        title: title,
                        body: "Powered by popkid",
                        thumbnailUrl,
                        sourceUrl: video.url,
                        mediaType: 2,
                        renderLargerThumbnail: true
                    }
                }
            });

        } catch (error) {
            console.error(`[VIDEO2 ERROR]`, error);
            await m.react('❌').catch(() => {});
            await m.reply(`❌ *VIDEO ERROR*\n━━━━━━━━━━━━━━━━\n${error.message}\n━━━━━━━━━━━━━━━━\n© popkid`);
        }
    }
};
