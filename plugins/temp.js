const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'deltmp',
    category: 'Admin',
    description: 'ᴅᴇʟᴇᴛᴇ ᴛᴇᴍᴘᴏʀᴀʀʏ ғɪʟᴇs ғʀᴏᴍ ᴛᴍᴘ ғᴏʟᴅᴇʀ',
    aliases: ['cleantmp', 'removetmp'],
    tags: ['tools'],
    command: /^\.?(deltmp|cleantmp|removetmp)$/i,

    async execute(sock, m, args) {
        try {
            const tmpDir = './tmp';
            
            if (!fs.existsSync(tmpDir)) {
                await m.reply('❌ ᴛᴍᴘ ғᴏʟᴅᴇʀ ᴅᴏᴇs ɴᴏᴛ ᴇxɪsᴛ');
                return;
            }

            const files = fs.readdirSync(tmpDir);
            
            if (files.length === 0) {
                await m.reply('📁 ᴛᴍᴘ ғᴏʟᴅᴇʀ ɪs ᴀʟʀᴇᴀᴅʏ ᴇᴍᴘᴛʏ');
                return;
            }

            await m.reply(`🧹 ᴄʟᴇᴀɴɪɴɢ ${files.length} ᴛᴇᴍᴘᴏʀᴀʀʏ ғɪʟᴇs...`);

            let deletedCount = 0;
            let errorCount = 0;

            for (const file of files) {
                const filePath = path.join(tmpDir, file);
                try {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                } catch (err) {
                    console.error(`ғᴀɪʟᴇᴅ ᴛᴏ ᴅᴇʟᴇᴛᴇ ${file}:`, err);
                    errorCount++;
                }
            }

            const resultMsg = `
ʀᴇsᴜʟᴛ: ✅ ᴄʟᴇᴀɴᴜᴘ ᴄᴏᴍᴘʟᴇᴛᴇ!

sᴜᴍᴍᴀʀʏ:
• ᴅᴇʟᴇᴛᴇᴅ: ${deletedCount} ғɪʟᴇs
• ғᴀɪʟᴇᴅ: ${errorCount} ғɪʟᴇs
• ᴛᴏᴛᴀʟ: ${files.length} ғɪʟᴇs

🗑️ ᴛᴇᴍᴘ ғᴏʟᴅᴇʀ ᴄʟᴇᴀɴᴇᴅ ᴜᴘ
            `.trim();

            await m.reply(resultMsg);

        } catch (err) {
            console.error('ᴅᴇʟᴛᴍᴘ ᴇʀʀᴏʀ:', err);
            await m.reply('❌ ᴇʀʀᴏʀ ᴄʟᴇᴀɴɪɴɢ ᴛᴇᴍᴘᴏʀᴀʀʏ ғɪʟᴇs: ' + err.message);
        }
    }
};
