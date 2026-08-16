const { cmd } = require('../arslan');

cmd({
    pattern: "dlstatus",
    name: 'dlstatus',
    category: 'Tools',
    aliases: ['save', 'statusdl'],
    description: 'Download a quoted Status update',
    filename: __filename
}, async (sock, m, args) => {
    if (!global.owners.includes(m.sender)) {
        return;
    }

    if (!m.quoted || !m.quoted.isStatus) {
        return m.reply('Please reply to a Status update and type .dlstatus');
    }

    try {
        if (m.quoted.type === 'conversation' || m.quoted.type === 'extendedTextMessage') {
            return m.reply(`📝 *Status Text:*\n\n${m.quoted.body}`);
        }

        if (!m.quoted.isMedia) {
            return m.reply('That status has no downloadable content.');
        }

        const buffer = await m.quoted.download();
        const mediaData = m.quoted.message[m.quoted.type];
        const caption = mediaData?.caption || '';

        if (m.quoted.type === 'imageMessage') {
            await sock.sendMessage(m.from, { image: buffer, caption }, { quoted: m });
        } else if (m.quoted.type === 'videoMessage') {
            await sock.sendMessage(m.from, { video: buffer, caption, mimetype: m.quoted.mimetype }, { quoted: m });
        } else if (m.quoted.type === 'audioMessage') {
            await sock.sendMessage(m.from, { audio: buffer, mimetype: m.quoted.mimetype, ptt: mediaData?.ptt || false }, { quoted: m });
        } else {
            return m.reply('Unsupported status media type.');
        }
    } catch (err) {
        console.error('dlstatus error:', err.message);
        m.reply('❌ Failed to download status media.');
    }
});
