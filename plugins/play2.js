import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
  name: 'play2',
  aliases: ['pl2', 'ply2', 'song2'],
  description: 'Downloads songs from YouTube and sends audio (backup/alt source)',
  run: async (context) => {
    const { client, m, text } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

    try {
      const query = text ? text.trim() : '';

      if (!query) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        return sendInteractive(client, m, `📌 *PLAY2*\n━━━━━━━━━━━━━━━━\nYou forgot to type something, genius.\nGive me a song name OR a YouTube link.\nExample: .play2 harlem shake\nOr: .play2 https://youtu.be/dQw4w9WgXcQ\n━━━━━━━━━━━━━━━━\n© popkid`);
      }

      await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

      const isYoutubeLink = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?[a-zA-Z0-9_-]{11})/gi.test(query);

      let audioUrl, filename, thumbnail, sourceUrl;

      if (isYoutubeLink) {
        const response = await fetch(`https://api.sidycoders.xyz/api/ytdl?url=${encodeURIComponent(query)}&format=mp3&apikey=memberdycoders`);
        const data = await response.json();

        if (!data.status || !data.cdn) {
          await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
          return sendInteractive(client, m, `│ Can't download that YouTube link.\n│ Your link is probably broken or private.\n│ Even I have limits, unlike your stupidity.\n╰───────────────\n> © popkid`);
        }

        audioUrl = data.cdn;
        filename = data.title || "Unknown YouTube Song";
        thumbnail = "";
        sourceUrl = query;
      } else {
        if (query.length > 100) {
          await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
          return sendInteractive(client, m, "│ Song title longer than my patience. 100 chars MAX!\n╰───────────────\n> © popkid");
        }

        const response = await fetch(`https://apiziaul.vercel.app/api/downloader/ytplaymp3?query=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (!data.status || !data.result?.downloadUrl) {
          await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
          return sendInteractive(client, m, `│ No song found for "${query}".\n│ Your music taste is as bad as your search skills.\n╰───────────────\n> © popkid`);
        }

        audioUrl = data.result.downloadUrl;
        filename = data.result.title || "Unknown Song";
        thumbnail = data.result.thumbnail || "";
        sourceUrl = data.result.videoUrl || "";
      }

      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });

      await client.sendMessage(m.chat, {
        audio: { url: audioUrl },
        mimetype: "audio/mpeg",
        fileName: `${filename}.mp3`,
        contextInfo: thumbnail ? {
          externalAdReply: {
            title: filename.substring(0, 30),
            body: "Powered by popkid",
            thumbnailUrl: thumbnail,
            sourceUrl: sourceUrl,
            mediaType: 1,
            renderLargerThumbnail: true } } : undefined });

      await client.sendMessage(m.chat, {
        document: { url: audioUrl },
        mimetype: "audio/mpeg",
        fileName: `${filename.replace(/[<>:"/\\|?*]/g, '_')}.mp3`,
        caption: `📌 *PLAY2*\n━━━━━━━━━━━━━━━━\n${filename}\n━━━━━━━━━━━━━━━━\n© popkid`
      });

    } catch (error) {
      console.error('Play2 error:', error);
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
      await sendInteractive(client, m, `❌ *PLAY2 ERROR*\n━━━━━━━━━━━━━━━━\nPlay failed. The universe rejects your music taste.\n━━━━━━━━━━━━━━━━\n© popkid`);
    }
  }
};
