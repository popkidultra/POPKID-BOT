const fs = require('fs');
const axios = require('axios');
const BodyForm = require('form-data');

const { cmd } = require('../arslan');

cmd({
    pattern: "tourl",
    name: 'tourl',
    category: 'Tools',
    description: 'Upload files to uguu.se and get URL',
    aliases: ['upload', 'geturl', 'uguu'],
    tags: ['tools'],
    command: /^\.?(tourl|upload|geturl|uguu)$/i,
    filename: __filename
}, async (sock, m, args) => {
        try {
            const quoted = m.quoted ? m.quoted : m;
            const mime = (quoted.msg || quoted).mimetype || '';
            
            if (!mime) {
                await m.reply(`┏━━━━━━━━━━━━━━━━━━━━┓
┃ ᴇʀʀᴏʀ 
┃ 
┃ ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ 
┃ ɪᴍᴀɢᴇ, ᴠɪᴅᴇᴏ, ᴏʀ ᴀᴜᴅɪᴏ
┃ 
┃ ᴇxᴀᴍᴘʟᴇ: .ᴛᴏᴜʀʟ
┗━━━━━━━━━━━━━━━━━━━━┛`);
                return;
            }

            await m.reply(`┏━━━━━━━━━━━━━━━━━━━━┓
┃ ᴜᴘʟᴏᴀᴅɪɴɢ...
┃ 
┃ ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ ᴀ ᴍᴏᴍᴇɴᴛ
┗━━━━━━━━━━━━━━━━━━━━┛`);

            const buffer = await quoted.download();

            if (!fs.existsSync('./tmp')) {
                fs.mkdirSync('./tmp', { recursive: true });
            }

            let ext = mime.split('/')[1];
            if (ext === 'jpeg') ext = 'jpg';
            if (ext === 'quicktime') ext = 'mov';
            if (ext === 'x-matroska') ext = 'mkv';
            
            const fileName = `./tmp/upload_${Date.now()}.${ext}`;
            fs.writeFileSync(fileName, buffer);

            const result = await UploadFileUgu(fileName);
            
            fs.unlinkSync(fileName);

            const fileSizeKB = (buffer.length / 1024).toFixed(2);
            const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
            
            const uploadUrl = result.url || result;
            
            const response = `┏━━━━━━━━━━━━━━━━━━━━┓
┃ ᴜᴘʟᴏᴀᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟ
┃ 
┃ ᴛʏᴘᴇ: ${mime.split('/')[0].toUpperCase()}
┃ ꜱɪᴢᴇ: ${fileSizeKB} ᴋʙ (${fileSizeMB} ᴍʙ)
┃ ᴜʀʟ: ${uploadUrl}
┃ 
┃ ᴜᴘʟᴏᴀᴅᴇᴅ ᴛᴏ ᴜɢᴜᴜ.ꜱᴇ
┗━━━━━━━━━━━━━━━━━━━━┛`;
            
            await m.reply(response);

        } catch (err) {
            console.error('Tourl Error:', err);
            await m.reply(`┏━━━━━━━━━━━━━━━━━━━━┓
┃ ᴜᴘʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ
┃ 
┃ ᴇʀʀᴏʀ: ${err.message.substring(0, 50)}
┃ 
┃ ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ
┗━━━━━━━━━━━━━━━━━━━━┛`);
        }
    });
