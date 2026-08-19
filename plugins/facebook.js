const { cmd } = require('../arslan');

const NEXRAY = 'https://api.nexray.web.id/downloader/facebook?url=';

cmd({
    pattern: "fbdl",
    name: 'fbdl',
    category: 'Downloaders',
    aliases: ['fb', 'facebook'],
    description: 'Download a Facebook video',
    filename: __filename
}, async (sock, m, args) => {
    await m.react('⌛');

    const text = args && args.length ? args.join(' ').trim() : '';
    const prefix = global.BOT_PREFIX || '.';

    if (!text) {
        await m.react('❌').catch(() => {});
        return m.reply(`❍ Example: ${prefix}fbdl https://fb.watch/xxxxx ❍\n> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓`);
    }

    if (!text.includes('facebook.com') && !text.includes('fb.watch')) {
        await m.react('❌').catch(() => {});
        return m.reply('❍ That\'s not a Facebook link. ❍\n> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓');
    }

    try {
        const r = await fetch(NEXRAY + encodeURIComponent(text), { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const d = await r.json();

        if (!d.status || !d.result) throw new Error('API failed');

        const { title, video_hd, video_sd } = d.result;
        const videoUrl = video_hd || video_sd;
        if (!videoUrl) throw new Error('No video URL found');

        const dlRes = await fetch(videoUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!dlRes.ok) throw new Error('Download failed: ' + dlRes.status);

        const buf = Buffer.from(await dlRes.arrayBuffer());

        await m.react('✅');
        await sock.sendMessage(m.from, {
            video: buf,
            mimetype: 'video/mp4',
            caption: `❍ Facebook DL ❍\n${title || 'Facebook Video'}\nQuality: ${video_hd ? 'HD' : 'SD'}\n> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓`
        });

    } catch (e) {
        await m.react('❌').catch(() => {});
        await m.reply(`❍ Failed: ${e.message} ❍\n> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓`);
    }
});
