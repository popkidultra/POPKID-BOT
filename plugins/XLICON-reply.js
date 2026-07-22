module.exports = {
    name: 'autorise',
    hidden: true,
    description: 'Auto reply audio when popkid is detected',

    async execute() {},

    async onMessage(sock, m) {
        if (!m.text) return;

        const text = m.text.trim().toLowerCase();
        const triggers = ['popkid'];

        const isTriggered = triggers.includes(text);

        if (isTriggered) {
            try {
                const name = m.pushName || m.sender.split('@')[0];
                const audioUrl = 'https://files.catbox.moe/tcz5xk.mp3';
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
                        audio: { url: audioUrl },
                        mimetype: 'audio/mpeg',
                        ptt: false,
                        waveform: [100, 0, 100, 0, 100, 0, 100],
                        fileName: 'POPKID',
                        contextInfo: {
                            mentionedJid: [m.sender],
                            externalAdReply: {
                                title: 'THIS IS POPKID',
                                body: 'HI AM HERE ANY HELP ?',
                                thumbnailUrl: thumbnail,
                                sourceUrl: 'https://popkid.my.id/',
                                mediaType: 1,
                                renderLargerThumbnail: true,
                            },
                        },
                    },
                    { quoted }
                );

            } catch (err) {
                console.error('❌ popkid error:', err);
            }
        }
    },
};
