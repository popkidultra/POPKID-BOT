const { cmd } = require('../arslan');

const NEXRAY = 'https://api.nexray.web.id/downloader/v2/instagram?url=';

cmd({
    pattern: "igdl",
    name: 'igdl',
    category: 'Downloaders',
    aliases: ['instadl', 'insta', 'instagram', 'ig'],
    description: 'Download Instagram photos/videos/carousels',
    filename: __filename
}, async (sock, m, args) => {
    await m.react('⌛');

    const text = args && args.length ? args.join(' ').trim() : '';

    if (!text) {
        await m.react('❌').catch(() => {});
        return m.reply('❍ IGDL ❍\nGive me an Instagram link.\n> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓');
    }

    if (!text.includes('instagram.com')) {
        await m.react('❌').catch(() => {});
        return m.reply('❍ IGDL ❍\nThat\'s not an Instagram link.\n> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓');
    }

    try {
        const r = await fetch(NEXRAY + encodeURIComponent(text), { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const d = await r.json();

        if (!d.status || !d.result) throw new Error('API failed');

        const { title, likes, comment, username, media } = d.result;
        if (!media || !media.length) throw new Error('No media found');

        await m.react('✅');

        for (const item of media.slice(0, 5)) {
            try {
                const dlRes = await fetch(item.url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.instagram.com/' } });
                if (!dlRes.ok) continue;

                const buf = Buffer.from(await dlRes.arrayBuffer());
                const cap =
                    `❍ Instagram DL ❍\n` +
                    `${title || 'Instagram Post'}\n` +
                    `👤 @${username || 'unknown'}\n` +
                    `❤️ ${likes ? likes.toLocaleString() : 'N/A'} likes | 💬 ${comment ? comment.toLocaleString() : 'N/A'} comments\n` +
                    `> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓`;

                if (item.type === 'mp4') {
                    await sock.sendMessage(m.from, { video: buf, caption: cap, mimetype: 'video/mp4' });
                } else {
                    await sock.sendMessage(m.from, { image: buf, caption: cap });
                }
            } catch {}
        }

    } catch (e) {
        await m.react('❌').catch(() => {});
        await m.reply(`❍ Failed: ${e.message} ❍\n> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓`);
    }
});
