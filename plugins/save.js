const { cmd } = require('../arslan');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const typeMap = {
    imageMessage: 'image',
    videoMessage: 'video',
    stickerMessage: 'sticker',
    audioMessage: 'audio',
    pttMessage: 'audio',
    documentMessage: 'document'
};

async function _dlMedia(sock, quoted) {
    const mtype = quoted.type || '';
    const mediaType = typeMap[mtype];
    if (!mediaType) return null;

    try {
        const node = quoted.message?.[mtype];
        const stream = await downloadContentFromMessage(node, mediaType);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        return buf.length > 0 ? buf : null;
    } catch {
        try { return await quoted.download(); } catch { return null; }
    }
}

cmd({
    pattern: "sv",
    name: 'sv',
    category: 'Tools',
    aliases: ['save', 'savemedia'],
    description: 'Save the quoted message to your own DM',
    filename: __filename
}, async (sock, m, args) => {
    await m.react('⌛');

    if (!m.quoted) {
        await m.react('❌').catch(() => {});
        return m.reply(
            `╭─❏ 「 SAVE」\n` +
            `│ \n` +
            `│ Reply to something first, genius.\n` +
            `╰───────────────\n` +
            `> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃𝐁𝐎𝐓`
        );
    }

    const quoted = m.quoted;
    const mtype = quoted.type || '';
    const senderNum = m.sender.split('@')[0].split(':')[0];
    const targetJid = senderNum + '@s.whatsapp.net';

    try {
        await m.react('💾');

        const node = quoted.message?.[mtype] || {};
        const caption = quoted.body || node.caption || '';
        const mime = quoted.mimetype || node.mimetype || '';
        const mediaTypes = ['imageMessage', 'videoMessage', 'stickerMessage', 'audioMessage', 'pttMessage', 'documentMessage'];

        if (mediaTypes.includes(mtype)) {
            const buf = await _dlMedia(sock, quoted);
            if (!buf) throw new Error('download failed');

            if (mtype === 'imageMessage') {
                await sock.sendMessage(targetJid, { image: buf, caption });
            } else if (mtype === 'videoMessage') {
                await sock.sendMessage(targetJid, { video: buf, caption });
            } else if (mtype === 'stickerMessage') {
                await sock.sendMessage(targetJid, { sticker: buf });
            } else if (mtype === 'audioMessage' || mtype === 'pttMessage') {
                await sock.sendMessage(targetJid, { audio: buf, mimetype: mime || 'audio/ogg; codecs=opus', ptt: mtype === 'pttMessage' });
            } else if (mtype === 'documentMessage') {
                await sock.sendMessage(targetJid, { document: buf, mimetype: mime || 'application/octet-stream', fileName: node.fileName || 'file' });
            }
        } else {
            const txt = quoted.body || node.caption || '';
            if (txt) {
                await sock.sendMessage(targetJid, { text: txt });
            } else {
                await sock.sendMessage(targetJid, { forward: { key: quoted.key, message: quoted.message } });
            }
        }

        await m.react('✅');

    } catch (err) {
        console.log('❌ [SAVE]:', err?.message || err);
        await m.react('❌').catch(() => {});
    }
});
