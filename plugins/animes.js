const axios = require('axios');

const supportedAnimes = [
    'akira', 'akiyama', 'anna', 'asuna', 'ayuzawa', 'boruto', 'chiho', 'chitoge',
    'deidara', 'erza', 'elaina', 'eba', 'emilia', 'hestia', 'hinata', 'inori',
    'isuzu', 'itachi', 'itori', 'kaga', 'kagura', 'kaori', 'keneki', 'kotori',
    'kurumi', 'madara', 'mikasa', 'miku', 'minato', 'naruto', 'nezuko', 'sagiri',
    'sasuke', 'sakura'
];

function pickRandom(arr, count = 1) {
    const shuffled = arr.slice().sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

const animuMenu = '🎀 *Animes Menu* 🎀\n\n' +
    supportedAnimes.map(a => `• *${a}*`).join('\n') +
    '\n\n📌 *Usage:*\n' +
    '.animes <name>\n' +
    'Example: *.animes naruto*';

module.exports = {
    name: 'animes',
    aliases: ['animeimg', 'animepic'],
    category: 'Fun',
    description: 'Send random anime images',

    async execute(sock, m, args) {
        const chatId = m.from;
        const input = args[0] || '';
        const typeLower = input.toLowerCase();

        if (!input || !supportedAnimes.includes(typeLower)) {
            const replyText = input && !supportedAnimes.includes(typeLower)
                ? `Unsupported anime: ${typeLower}\n\n`
                : '';
            return await m.reply(replyText + animuMenu);
        }

        try {
            const apiUrl = `https://raw.githubusercontent.com/Guru322/api/Guru/BOT-JSON/anime-${typeLower}.json`;
            const res = await axios.get(apiUrl, { timeout: 15000, validateStatus: s => s < 500 });
            const images = res.data;

            if (!Array.isArray(images) || images.length === 0) {
                throw new Error('No images found');
            }

            const randomImages = pickRandom(images, Math.min(3, images.length));
            let sentAny = false;

            for (const img of randomImages) {
                try {
                    const imageData = await axios.get(img, { responseType: 'arraybuffer', timeout: 15000 });
                    await sock.sendMessage(chatId, {
                        image: Buffer.from(imageData.data),
                        caption: `_${typeLower}_`
                    }, { quoted: m.key });
                    sentAny = true;
                } catch (imgErr) {
                    console.error(`Anime image fetch failed (${img}):`, imgErr.message);
                }
            }

            if (!sentAny) {
                await m.reply('❌ Could not fetch any images for that anime right now. Try again later.');
            }

        } catch (err) {
            console.error('Animes plugin error:', err.message);
            await m.reply('❌ Failed to fetch anime images. Please try again later.');
        }
    }
};
