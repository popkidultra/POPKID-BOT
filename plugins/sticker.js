const { Sticker, StickerTypes } = require('wa-sticker-formatter');

module.exports = {
    name: 'sticker',
    category: 'Tools',
    description: 'Convert an image to sticker',
    aliases: ['s', 'stkr'],
    tags: ['main'],
    command: /^\.?sticker$/i,

    async execute(sock, m) {
        try {
            const target = m.quoted || m;

            if (!target.message?.imageMessage) {
                return m.reply('Please reply to an image or send an image with .sticker command.');
            }

            let mediaBuffer;
            if (typeof target.download === 'function') {
                mediaBuffer = await target.download();
            } else {
                return m.reply('Cannot download the image.');
            }

            const sticker = new Sticker(mediaBuffer, {
                pack: 'POPKID',
                author: 'Abraham',
                type: StickerTypes.FULL,
                quality: 50,
            });

            const stickerBuffer = await sticker.toBuffer();
            await sock.sendMessage(m.from, { sticker: stickerBuffer });

            console.log(`Sticker sent in chat ${m.from}`);
        } catch (err) {
            console.error('Sticker command error:', err);
            m.reply('Failed to create sticker.');
        }
    }
};
