const yts = require('yt-search');
const axios = require('axios');

const { cmd } = require('../arslan');

const DL_API = 'https://api--shadowcorexyz.replit.app/download/ytmp3';

cmd({
    pattern: "play",
    name: 'play',
    category: 'Downloaders',
    aliases: ['plays', 'music', 'song'],
    description: 'Search and download a song as MP3 from YouTube',
    filename: __filename
}, async (sock, m, args) => {
    const query = args.join(' ').trim();

    if (!query) {
        return m.reply('*Which song do you want to play?*\nUsage: .play <song name>');
    }

    try {
        await m.reply('🔍 *Searching...*');

        const { videos } = await yts(query);

        if (!videos?.length) {
            return m.reply('❌ *No results found!*');
        }

        const video = videos[0];

        await m.reply(`✅ *Found:* ${video.title}\n⏱️ ${video.timestamp}\n👤 ${video.author.name}\n\n⏳ *Downloading...*`);

        // Step 1: ask the API for a download link.
        let downloadURL, title;
        try {
            const { data } = await axios.get(DL_API, {
                params: { url: video.url },
                timeout: 60000
            });

            if (!data?.status || !data?.data?.dl) {
                console.error('play: unexpected API response shape:', JSON.stringify(data));
                return m.reply('❌ *Failed to fetch audio. Please try again later.*');
            }

            downloadURL = data.data.dl;
            title = data.data.title || video.title;
        } catch (apiErr) {
            console.error('play: API request failed:', apiErr);
            return m.reply('❌ *Failed to reach the download API. Please try again later.*');
        }

        // Step 2: fetch the actual audio bytes ourselves instead of handing
        // Baileys the raw signed URL. Baileys internally probes a remote
        // audio URL's headers before sending it, and these signed CDN
        // links (cococo.epsiloncloud.org, sig=...) often return
        // missing/odd headers that make that internal probe throw a vague
        // "Cannot read properties of undefined" error. Downloading the
        // buffer ourselves sidesteps that entirely.
        let buffer;
        try {
            const audioRes = await axios.get(downloadURL, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            buffer = Buffer.from(audioRes.data);

            // Sanity-check we actually got audio bytes back, not an HTML
            // error page or empty body from the signed link.
            const contentType = audioRes.headers['content-type'] || '';
            console.log(`play: downloaded ${buffer.length} bytes, content-type: ${contentType}`);

            if (buffer.length < 10000) {
                console.error('play: buffer suspiciously small, first 200 bytes:', buffer.toString('utf8', 0, 200));
                return m.reply('❌ *The download link returned an invalid file. Try again.*');
            }
        } catch (fetchErr) {
            console.error('play: audio buffer fetch failed:', fetchErr);
            return m.reply('❌ *Failed to download the audio file. Try again.*');
        }

        // Step 3: send the buffer, not a URL.
        try {
            console.log(`play: sending audio, m.from=${m.from}, buffer size=${buffer.length}`);
            await sock.sendMessage(m.from, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`
            }, { quoted: m });
        } catch (sendErr) {
            console.error('play: sendMessage failed. Name:', sendErr?.name, 'Message:', sendErr?.message, 'Stack:', sendErr?.stack);
            return m.reply('❌ *Downloaded the audio but failed to send it. Try again.*');
        }

    } catch (err) {
        console.error('play: unexpected error:', err);
        m.reply(`❌ *Failed:* ${err.message || err}`);
    }
});
