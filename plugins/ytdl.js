const axios = require('axios');

const yts = require('yt-search');

module.exports = {

name: 'play',
    category: 'Downloaders',

description: 'Download YouTube audio (link or search)',

aliases: ['ytmp3', 'ytaudio', 'ytdlv3'],

tags: ['downloader'],

command: /^.?(ytdl|ytmp3|ytaudio|ytdlv3)/i,

async execute(sock, m, args) {

try {



  if (!args[0]) {

    return m.reply("Usage:\n.ytdl <youtube link>\n.ytdl <search query>");

  }



  await m.reply("⭐𝘗𝘭𝘦𝘢𝘴𝘦 𝘸𝘢𝘪𝘵... 𝘗𝘳𝘰𝘤𝘦𝘴𝘴𝘪𝘯𝘨 𝘳𝘦𝘲𝘶𝘦𝘴𝘵.");



  let input = args.join(" ").trim();

  let finalUrl = input;



  if (!input.includes("youtube.com") && !input.includes("youtu.be")) {

    const results = await yts(input);



    if (!results || !results.videos || results.videos.length === 0) {

      return m.reply("No results found on YouTube.");

    }



    finalUrl = results.videos[0].url;

  }



  const apiUrl = `https://api-abztech.zone.id/download/ytdlv3?url=${encodeURIComponent(finalUrl)}`;

  const apiRes = await axios.get(apiUrl);

  const data = apiRes.data;



  if (!data || !data.status) {

    return m.reply(`API Error: ${data?.message || "Unknown error"}`);

  }



  const { downloadUrl, filename, title, thumbnail } = data;



  const audioRes = await axios.get(downloadUrl, {

    responseType: "arraybuffer"

  });



  const buffer = Buffer.from(audioRes.data);



  const quotedMsg = m.quoted || {

    key: {

      remoteJid: m.from,

      fromMe: false,

      id: m.id,

      participant: m.sender

    },

    message: {

      extendedTextMessage: {

        text: m.body

      }

    }

  };



  await sock.sendMessage(

    m.from,

    {

      audio: buffer,

      mimetype: "audio/mpeg",

      fileName: filename,

      ptt: false,

      contextInfo: {

        forwardingScore: 999,

        isForwarded: true,

        forwardedNewsletterMessageInfo: {

          newsletterJid: '120363426778975572@newsletter',

          newsletterName: '😷popkid😷',

          serverMessageId: 1

        },

        externalAdReply: {

          title: title || filename,

          body: "Powered by popkid Tech",

          thumbnailUrl: thumbnail,   

          mediaType: 1,

          mediaUrl: finalUrl,

          sourceUrl: finalUrl,

          renderLargerThumbnail: true,

          showAdAttribution: false

        }

      }

    },

    { quoted: quotedMsg }

  );



} catch (err) {

  console.error('YTDL error:', err.response?.data || err.message);

  m.reply('Failed to process request.');

}

}

};
