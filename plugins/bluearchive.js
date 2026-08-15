const axios = require('axios');

const { cmd } = require('../arslan');

cmd({
    pattern: "bluearchive",
    name: 'bluearchive',
    category: 'Fun',
    aliases: ['ba', 'blue'],
    filename: __filename
}, async (sock, m, args) => {
        await m.reply(`ғᴇᴛᴄʜɪɴɢ ʙʟᴜᴇ ᴀʀᴄʜɪᴠᴇ ɪᴍᴀɢᴇ...`);
        
        try {
            const imageUrl = `https://api-rebix.zone.id/api/bluearchive`;
            
            const response = await axios({
                method: 'get',
                url: imageUrl,
                responseType: 'arraybuffer',
                timeout: 30000
            });
            
            const buffer = Buffer.from(response.data);
            
            await m.reply(buffer, { caption: `ᴏᴋᴀʏ ғᴏʀ ʏᴏᴜ?` });
            
        } catch (err) {
            console.error('bluearchive error:', err);
            await m.reply(`ғᴀɪʟᴇᴅ ᴛᴏ ғᴇᴛᴄʜ ɪᴍᴀɢᴇ\n\n${err.message}`);
        }
    });
