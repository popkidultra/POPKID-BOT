const { cmd } = require('../arslan');

cmd({
    pattern: "lyrics",
    name: 'lyrics',
    aliases: ['lyric', 'songlyrics'],
    category: 'Fun',
    description: 'Get lyrics of a song along with artist and image',
    filename: __filename
}, async (sock, m, args) => {
        const chatId = m.from;
        const songTitle = args.join(' ').trim();

        if (!songTitle) {
            return await m.reply('*Please enter the song name to get the lyrics!*\nUsage: `.lyrics <song name>`');
        }

        try {
            const apiUrl = `https://discardapi.dpdns.org/api/music/lyrics?apikey=qasim&song=${encodeURIComponent(songTitle)}`;
            const res = await fetch(apiUrl);

            if (!res.ok) throw new Error(`API request failed with status ${res.status}`);

            const data = await res.json();
            const messageData = data?.result?.message;

            if (!messageData?.lyrics) {
                return await m.reply(`❌ Sorry, I couldn't find any lyrics for "${songTitle}".`);
            }

            const { artist, lyrics, image, title, url } = messageData;
            const maxChars = 4096;
            const lyricsOutput = lyrics.length > maxChars ? `${lyrics.slice(0, maxChars - 3)}...` : lyrics;

            const caption = `
🎵 *${title}*
👤 *Artist:* ${artist}
🔗 *URL:* ${url}

📝 *Lyrics:*
${lyricsOutput}
            `.trim();

            if (image) {
                await sock.sendMessage(chatId, {
                    image: { url: image },
                    caption
                }, { quoted: m.key });
            } else {
                await m.reply(caption);
            }

        } catch (error) {
            console.error('Lyrics Command Error:', error.message);
            await m.reply(`❌ An error occurred while fetching the lyrics for "${songTitle}".`);
        }
    });
