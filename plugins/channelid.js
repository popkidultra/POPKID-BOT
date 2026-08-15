const { cmd } = require('../arslan');

cmd({
    pattern: "channelid",
    name: 'channelid',
    category: 'Channel',
    aliases: ['chid'],
    description: 'Get channel ID from invite code',
    enabled: true,
    filename: __filename
}, async (sock, m, args) => {
        try {
            let input = args[0];
            if (!input) {
                return m.reply('ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴄʜᴀɴɴᴇʟ ɪɴᴠɪᴛᴇ ᴄᴏᴅᴇ.\nᴇxᴀᴍᴘʟᴇ: .ᴄʜᴀɴɴᴇʟɪᴅ 0029VbBu0ULJP21Bq5OFVo43');
            }
            if (input.includes('whatsapp.com/channel/')) {
                input = input.split('channel/')[1].split('?')[0];
            }

            const result = await sock.newsletterMetadata('invite', input);
            
            m.reply(`📌 ᴄʜᴀɴɴᴇʟ ɪᴅ: ${result.id}`);

        } catch (err) {
            m.reply('❌ ɪɴᴠᴀʟɪᴅ ᴄʜᴀɴɴᴇʟ ɪɴᴠɪᴛᴇ ᴄᴏᴅᴇ.');
        }
    });
