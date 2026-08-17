const yts = require('yt-search');

const { cmd } = require('../arslan');

cmd({
    pattern: "vid",
    name: 'vid',
    category: 'Downloaders',
    aliases: ['vidsearch', 'videosr'],
    description: 'Search YouTube and download the top result as video',
    filename: __filename
}, async (sock, m, args) => {
    await m.react('⌛');

    const text = args && args.length ? args.join(' ').trim() : '';

    if (!text) {
        await m.react('❌').catch(() => {});
        return m.reply("╭─❏ 「 VIDEO」\n│ Give me a video name, it's not rocket science.\n╰───────────────\n> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓");
    }
    if (text.length > 100) {
        await m.react('❌').catch(() => {});
        return m.reply("╭─❏ 「 VIDEO」\n│ Title longer than your attention span. Under 100 chars!\n╰───────────────\n> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓");
    }

    try {
        const searchQuery = `${text} official`;
        const searchResult = await yts(searchQuery);
        const video = searchResult.videos[0];

        if (!video) {
            await m.react('❌').catch(() => {});
            return m.reply(`╭─❏ 「 VIDEO 」\n│ Nothing found for "${text}". Your taste doesn't exist.\n╰───────────────\n> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓`);
        }

        const encodedUrl = encodeURIComponent(video.url);
        const response = await fetch(`https://api.ootaizumi.web.id/downloader/youtube?url=${encodedUrl}&format=720`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json"
            }
        });
        const data = await response.json();

        if (!data.status || !data.result || !data.result.download) {
            throw new Error('API returned no valid video data.');
        }

        const title = data.result.title || "Untitled";
        const videoUrl = data.result.download;
        const thumbnailUrl = data.result.thumbnail;

        await m.react('✅');

        await sock.sendMessage(m.from, {
            video: { url: videoUrl },
            mimetype: "video/mp4",
            fileName: `${title}.mp4`,
            contextInfo: {
                externalAdReply: {
                    title: title,
                    body: "𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓",
                    thumbnailUrl,
                    sourceUrl: video.url,
                    mediaType: 2,
                    renderLargerThumbnail: true
                }
            }
        });

    } catch (error) {
        console.error(`Video error:`, error);
        await m.react('❌').catch(() => {});
        let userMessage = 'Download failed. The universe despises your video choice.';
        if (error.message.includes('API returned')) userMessage = 'The video service rejected the request.';
        await m.reply(`╭─❏ 「 VIDEO ERROR」\n│ ${userMessage}\n│ ${error.message}\n╰───────────────\n> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓`);
    }
});
