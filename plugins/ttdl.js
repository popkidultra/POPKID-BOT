const axios = require('axios');
const fs = require('fs');

module.exports = {
    name: 'tiktok',
    category: 'Downloaders',
    description: 'Download TikTok videos without watermark',
    aliases: ['tt', 'tiktokdl', 'ttdl'],
    tags: ['downloader'],
    command: /^\.?(tiktok|tt|tiktokdl|ttdl)$/i,

    async execute(sock, m, args) {
        try {
            if (!args.length) {
                return await m.reply(`ᴜsᴀɢᴇ: .ᴛɪᴋᴛᴏᴋ <ᴜʀʟ>

ᴇxᴀᴍᴘʟᴇ: .ᴛɪᴋᴛᴏᴋ https://vt.tiktok.com/ZSrRVYRUJ/`);
            }

            const url = args[0];
            
            if (!url.includes('tiktok.com')) {
                return await m.reply('ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ᴛɪᴋᴛᴏᴋ ᴜʀʟ');
            }

            await m.reply('ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ...');

            const apiUrl = `https://api-rebix.zone.id/api/tiktok2?url=${encodeURIComponent(url)}`;
            
            const response = await axios.get(apiUrl);
            
            if (!response.data.status || !response.data.result) {
                return await m.reply('ғᴀɪʟᴇᴅ ᴛᴏ ғᴇᴛᴄʜ ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ\nᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ');
            }

            const result = response.data.result;
            
            const videoUrl = result.play;
            
            if (!videoUrl) {
                return await m.reply('ɴᴏ ᴠɪᴅᴇᴏ ᴜʀʟ ғᴏᴜɴᴅ');
            }

            const videoResponse = await axios.get(videoUrl, {
                responseType: 'arraybuffer'
            });

            const videoBuffer = Buffer.from(videoResponse.data);
            const fileName = `tiktok_${result.id}.mp4`;
            const filePath = `./temp/${fileName}`;

            if (!fs.existsSync('./temp')) {
                fs.mkdirSync('./temp', { recursive: true });
            }

            fs.writeFileSync(filePath, videoBuffer);

            const caption = `*ᴛɪᴋᴛᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*

ᴛɪᴛʟᴇ: ${result.title || 'ɴᴏ ᴛɪᴛʟᴇ'}
ᴅᴜʀᴀᴛɪᴏɴ: ${result.duration}s
ᴠɪᴇᴡs: ${result.play_count || 0}
ʟɪᴋᴇs: ${result.digg_count || 0}
ᴄᴏᴍᴍᴇɴᴛs: ${result.comment_count || 0}
sʜᴀʀᴇs: ${result.share_count || 0}

ᴀᴜᴛʜᴏʀ: ${result.author?.nickname || 'ᴜɴᴋɴᴏᴡɴ'}
@${result.author?.unique_id || ''}

ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ ʙʏ POPKID`;

            await sock.sendMessage(m.from, {
                video: fs.readFileSync(filePath),
                caption: caption,
                mimetype: 'video/mp4'
            });

            fs.unlinkSync(filePath);

        } catch (err) {
            console.error('TikTok Error:', err);
            await m.reply(`ᴇʀʀᴏʀ: ${err.message}`);
        }
    }
};
