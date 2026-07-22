module.exports = {
    name: 'niggareply',
    hidden: true,
    description: 'Auto reply when a specific person says or replies with "blind fella"',

    async execute() {},

    async onMessage(sock, m) {
        try {
            const text = (m.body || m.quoted?.body || m.text || m.message?.extendedTextMessage?.text || '').toLowerCase();
            const target = '195692299612239@lid';
            if (m.sender !== target || !text.includes('blind fella')) return;

            const name = m.pushName || m.sender.split('@')[0];
            const replyText = "he isn't blind nigga.";
            const thumbnail = 'https://i.ibb.co/WNv1hWXT/file-000000001f5c81f4a38f20223ae695d1.png';

            const quoted = {
                key: {
                    fromMe: false,
                    participant: m.sender,
                    ...(m.isGroup ? { remoteJid: m.from } : {}),
                },
                message: {
                    contactMessage: {
                        displayName: name,
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${name}\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
                    },
                },
            };

            await m.send(
                {
                    text: replyText,
                    contextInfo: {
                        mentionedJid: [m.sender],
                        externalAdReply: {
                            title: "bruh",
                            body: "look at this nigga",
                            thumbnailUrl: thumbnail,
                            sourceUrl: 'https://www.whatsapp.com/channel/0029VaMGgVL3WHTNkhzHik3c',
                            mediaType: 1,
                            renderLargerThumbnail: true,
                        },
                    },
                },
                { quoted }
            );

            await m.react("🤔");

        } catch (err) {
            console.error('❌ blindfella-reply error:', err);
        }
    }
};
