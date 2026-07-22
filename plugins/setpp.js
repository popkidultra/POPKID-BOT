module.exports = {
    name: 'setpp',
    category: 'Admin',
    aliases: ['setprofile', 'setbotpp'],
    description: 'set bot profile picture',

    async execute(sock, m) {

        if (!m.isOwner) {
            return await m.reply('❌ ᴏᴡɴᴇʀ ᴏɴʟʏ ᴄᴏᴍᴍᴀɴᴅ!');
        }

        if (!m.quoted) {
            return await m.reply('ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ.');
        }

        try {
            let buffer = await m.quoted.download();

            if (!Buffer.isBuffer(buffer)) {
                buffer = buffer?.data 
                    ? Buffer.from(buffer.data) 
                    : Buffer.from(buffer);
            }

            const image = await Jimp.read(buffer);
         
            const processed = image.scaleToFit({ w: 720, h: 720 });

const finalBuffer = await processed.getBuffer('image/jpeg', {
  quality: 80
});

            await m.reply('⚙️ ᴜᴘᴅᴀᴛɪɴɢ ᴘʀᴏғɪʟᴇ ᴘɪᴄᴛᴜʀᴇ...');

            await sock.query({
                tag: "iq",
                attrs: { 
                    to: "@s.whatsapp.net", 
                    type: "set", 
                    xmlns: "w:profile:picture" 
                },
                content: [{
                    tag: "picture",
                    attrs: { type: "image" },
                    content: finalBuffer
                }]
            });

            await m.reply('✅ ᴘʀᴏғɪʟᴇ ᴘɪᴄᴛᴜʀᴇ ᴜᴘᴅᴀᴛᴇᴅ');

        } catch (err) {
            console.error(err);
            await m.reply('❌ ғᴀɪʟᴇᴅ ᴛᴏ ᴜᴘᴅᴀᴛᴇ ᴘʀᴏғɪʟᴇ ᴘɪᴄᴛᴜʀᴇ');
        }
    }
};
