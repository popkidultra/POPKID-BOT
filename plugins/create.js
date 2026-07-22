const axios = require('axios');

module.exports = {
    name: 'genimg',
    category: 'AI',
    aliases: ['gimg', 'gen', 'timg'],
    
    async execute(sock, m, args) {
        if (!args.length) {
            return m.reply(`ᴛᴇxᴛ ᴛᴏ ɪᴍᴀɢᴇ\n\nᴜsᴀɢᴇ: .ɢᴇɴɪᴍɢ <ᴛᴇxᴛ>\n\nexᴀᴍᴘʟᴇ: .ɢᴇɴɪᴍɢ ᴀ ᴄᴀᴛ sɪᴛᴛɪɴɢ ᴏɴ ᴀ ᴄʜᴀɪʀ`);
        }
        
        const text = args.join(' ');
        
        await m.reply(`ɢᴇɴᴇʀᴀᴛɪɴɢ ɪᴍᴀɢᴇ ғᴏʀ: ${text}`);
        
        try {
            const imageUrl = `https://api-abztech.zone.id/ai/genimg?text=${encodeURIComponent(text)}`;
            
            const response = await axios({
                method: 'get',
                url: imageUrl,
                responseType: 'arraybuffer',
                timeout: 30000
            });
            
            const buffer = Buffer.from(response.data);
            
            await m.reply(buffer, { caption: `ʜᴇʀᴇ ʏᴏᴜ ɢᴏ` });
            
        } catch (err) {
            console.error('genimg error:', err);
            await m.reply(`ғᴀɪʟᴇᴅ ᴛᴏ ɢᴇɴᴇʀᴀᴛᴇ ɪᴍᴀɢᴇ\n\n${err.message}`);
        }
    }
};
