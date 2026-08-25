const { cmd } = require('../arslan');

// Per-chat toggle state. In-memory only (matches the simple in-memory
// pattern plugins/autoreact.js already uses in this bot — there's no
// lowdb-style `db` object available here).
const antitagallChats = new Map();

const registered = cmd({
    pattern: "antitagall",
    name: 'antitagall',
    category: 'group',
    aliases: [],
    description: 'Auto-delete messages that mention too many people',
    filename: __filename
}, async (sock, m, args) => {
    const o = args[0] || '';

    if (!['--on', '--off'].includes(o)) {
        return m.reply('⚠️ Choose opsi:\n\n• --on\n• --off');
    }

    switch (o) {
        case '--on':
            antitagallChats.set(m.from, true);
            m.reply('✅ Anti TagAll berhasil activated');
            break;

        case '--off':
            antitagallChats.set(m.from, false);
            m.reply('❌ Anti TagAll berhasil deactivated');
            break;
    }
});

// Hooked into the same onMessage pipeline index.js already runs every
// non-command message through (see plugins/autoreact.js for the same pattern).
registered.onMessage = async (sock, m) => {
    if (!m.isGroup) return false;
    if (!antitagallChats.get(m.from)) return false;
    if (!m.mentionedJid || !m.mentionedJid.length) return false;

    const maxTag = 5;
    if (m.mentionedJid.length < maxTag) return false;

    try {
        const groupMetadata = await sock.groupMetadata(m.from);

        const senderId = m.sender;
        const senderBaseId = senderId.split(':')[0] + '@s.whatsapp.net';

        const isAdmin = groupMetadata.participants.some(p =>
            (p.id === senderId || p.id === senderBaseId) && p.admin === 'admin'
        );

        if (isAdmin) return false;

        const botId = sock.user.id;
        const botBaseId = botId.split(':')[0] + '@s.whatsapp.net';

        const isBotAdmin = groupMetadata.participants.some(p =>
            (p.id === botId || p.id === botBaseId) && p.admin === 'admin'
        );

        if (!isBotAdmin) return false;

        await sock.sendMessage(m.from, {
            delete: {
                remoteJid: m.from,
                fromMe: false,
                id: m.key.id,
                participant: m.sender
            }
        });

        await sock.sendMessage(m.from, {
            text: `*– 乂 Anti TagAll –*\nToo many mentions in a single message.`
        });

        return true;
    } catch (e) {
        console.error('AntiTagAll error:', e);
        return false;
    }
};
