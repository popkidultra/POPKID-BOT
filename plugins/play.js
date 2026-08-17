const { cmd } = require('../arslan');

cmd({
    pattern: "play",
    name: 'play',
    category: 'Downloaders',
    aliases: ['ply', 'playy', 'pl'],
    description: 'Downloads songs from YouTube and sends audio',
    filename: __filename
}, async (sock, m, args) => {
    await m.react('⌛');

    try {
        const query = args && args.length ? args.join(' ').trim() : '';

        if (!query) {
            await m.react('❌').catch(() => {});
            return m.reply(`╭─❏ 「 PLAY」\n│ You forgot to type something, genius.\n│ Give me a song name OR a YouTube link.\n│ Example: .play harlem shake\n│ Or: .play https://youtu.be/dQw4w9WgXcQ\n╰───────────────\n> ❤️‍🩹𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃`);
        }

        const isYoutubeLink = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?[a-zA-Z0-9_-]{11})/gi.test(query);

        let audioUrl, filename, thumbnail, sourceUrl;

        if (isYoutubeLink) {
            const response = await fetch(`https://api.sidycoders.xyz/api/ytdl?url=${encodeURIComponent(query)}&format=mp3&apikey=memberdycoders`);
            const data = await response.json();

            if (!data.status || !data.cdn) {
                await m.react('❌').catch(() => {});
                return m.reply(`│ Can't download that YouTube link.\n│ Your link is probably broken or private.\n│ Even I have limits, unlike your stupidity.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);
            }

            audioUrl = data.cdn;
            filename = data.title || "Unknown YouTube Song";
            thumbnail = "";
            sourceUrl = query;
        } else {
            if (query.length > 100) {
                await m.react('❌').catch(() => {});
                return m.reply("│ Song title longer than my patience. 100 chars MAX!\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧");
            }

            const response = await fetch(`https://apiziaul.vercel.app/api/downloader/ytplaymp3?query=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (!data.status || !data.result?.downloadUrl) {
                await m.react('❌').catch(() => {});
                return m.reply(`│ No song found for "${query}".\n│ Your music taste is as bad as your search skills.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);
            }

            audioUrl = data.result.downloadUrl;
            filename = data.result.title || "Unknown Song";
            thumbnail = data.result.thumbnail || "";
            sourceUrl = data.result.videoUrl || "";
        }

        await m.react('✅');

        await sock.sendMessage(m.from, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${filename}.mp3`,
            contextInfo: thumbnail ? {
                externalAdReply: {
                    title: filename.substring(0, 30),
                    body: "Toxic-MD",
                    thumbnailUrl: thumbnail,
                    sourceUrl: sourceUrl,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            } : undefined
        });

        await sock.sendMessage(m.from, {
            document: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${filename.replace(/[<>:"/\\|?*]/g, '_')}.mp3`,
            caption: `╭─❏ 「 PLAY」\n│ ${filename}\n╰───────────────\n> ©𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐏𝐎𝐏𝐊𝐈𝐃`
        });

    } catch (error) {
        console.error('Play error:', error);
        await m.react('❌').catch(() => {});
        await m.reply(`╭─❏ 「 PLAY ERROR」\n│ Play failed. The universe rejects your music taste.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);
    }
});
