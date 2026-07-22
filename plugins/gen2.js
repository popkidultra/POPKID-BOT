const axios = require('axios');
const FormData = require('form-data');

const client = axios.create({
  baseURL: 'https://emam-api-test.vercel.app/home/sections/Tools/api/imageEditPro'
});

const validRatios = ["1:1", "16:9", "3:2", "2:3", "4:5", "5:4", "9:16", "3:4", "4:3", "custom"];

module.exports = {
    name: 'gen2',
    category: 'AI',
    aliases: ['editimage', 'imgpro'],
    description: 'Edit images using AI based on prompt',

    async execute(sock, m, args) {
        if (!args[0]) {
            return m.reply(` Usᴀɢᴇ:
.ɢᴇɴ2 <ᴘʀᴏᴍᴘᴛ> | <ʀᴀᴛɪᴏ>

Exᴀᴍᴘʟᴇ:
.ɢᴇɴ2 ᴍᴀᴋᴇ sᴋɪɴ ʙʟᴀᴄᴋ | 1:1

Aᴠᴀɪʟᴀʙʟᴇ ʀᴀᴛɪᴏs: 
1:1, 16:9, 3:2, 2:3, 4:5, 5:4, 9:16, 3:4, 4:3, ᴄᴜsᴛᴏᴍ`);
        }

        if (!m.quoted || !m.quoted.mimetype || !m.quoted.mimetype.includes('image')) {
            return m.reply('⚠️ Pʟᴇᴀsᴇ ǫᴜᴏᴛᴇ ᴀɴ ɪᴍᴀɢᴇ ᴛᴏ ᴇᴅɪᴛ');
        }

        await m.reply('⏳ Pʀᴏᴄᴇssɪɴɢ ʏᴏᴜʀ ɪᴍᴀɢᴇ...');

        try {
            let [prompt, size] = args.join(' ').split('|');
            if (!prompt) prompt = args.join(' ');

            const imageBuffer = await m.quoted.download();
            
            const formData = new FormData();
            formData.append('image', imageBuffer, 'image.jpg');
            formData.append('prompt', prompt.trim());
            if (size && validRatios.includes(size.trim())) formData.append('size', size.trim());

            const createRes = await client.post('/process-image', formData, {
                headers: {
                    ...formData.getHeaders()
                }
            });

            const { status, recordId, message } = createRes.data;
            
            if (!status || !recordId) {
                throw new Error(message || 'Fᴀɪʟᴇᴅ ᴛᴏ sᴛᴀʀᴛ ᴘʀᴏᴄᴇssɪɴɢ');
            }

            let result = null;
            let error = null;
            let maxRetries = 40;
            let retries = 0;

            while (!result && !error && retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                retries++;
                
                const getRes = await client.get(`/check-result?rid=${recordId}`, {
                    responseType: 'arraybuffer'
                });
                
                const contentType = getRes.headers['content-type'];
                
                if (contentType?.includes('application/json')) {
                    const jsonData = JSON.parse(Buffer.from(getRes.data).toString('utf-8'));
                    if (jsonData.status === false && jsonData.message !== 'Processing not completed yet') {
                        error = jsonData.message;
                        break;
                    }
                } else if (contentType?.includes('image')) {
                    result = getRes.data;
                    break;
                }
            }

            if (retries >= maxRetries) throw new Error('Mᴀx ʀᴇᴛʀɪᴇs ʀᴇᴀᴄʜᴇᴅ, ɴᴏ ʀᴇsᴜʟᴛ');
            if (error) throw new Error(error);
            if (!result) throw new Error('Nᴏ ʀᴇsᴜʟᴛ ᴏʙᴛᴀɪɴᴇᴅ');

            await m.reply(Buffer.from(result), {
                caption: '✅ Iᴍᴀɢᴇ ᴇᴅɪᴛᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ!'
            });

        } catch (err) {
            console.error('Gen2 error:', err);
            await m.reply(`❌ Eʀʀᴏʀ: ${err.message}`);
        }
    }
};
