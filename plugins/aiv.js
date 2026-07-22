const axios = require('axios');
const fetch = require('node-fetch');

module.exports = {
  name: 'aivoice',
    category: 'AI',
  description: 'AI voice search with audio response',
  aliases: ['aiv', 'voiceai', 'aisv'],
  tags: ['ai', 'voice', 'search'],
  command: /^\.?(aiv|aivoice|voiceai|aisv)/i,

  async execute(sock, m, args) {
    try {
      if (!args[0]) {
        return m.reply("ᴜsᴀɢᴇ:\n.ᴀɪᴠ <ʏᴏᴜʀ ǫᴜᴇsᴛɪᴏɴ>\n.ᴀɪᴠ ʜɪ\nᴇxᴀᴍᴘʟᴇ: .ᴀɪᴠ ᴡʜᴀᴛ ɪs ᴛʜᴇ ᴄᴀᴘɪᴛᴀʟ ᴏꜰ ꜰʀᴀɴᴄᴇ");
      }

      await m.reply("⭐ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ... ᴛʜɪɴᴋɪɴɢ..");

      const userQuery = args.join(" ").trim();

      if (userQuery.toLowerCase() === 'hi' || userQuery.toLowerCase() === 'hello') {

        const greeting = "ʜᴇʟʟᴏ! ɪ'ᴍ ʏᴏᴜʀ ᴀɪ ᴠᴏɪᴄᴇ ᴀssɪsᴛᴀɴᴛ. ʜᴏᴡ ᴄᴀɴ ɪ ʜᴇʟᴘ ʏᴏᴜ ᴛᴏᴅᴀʏ?";

        const ttsResponse = await fetch(
          `https://ab-text-voice.abrahamdw882.workers.dev/?q=${encodeURIComponent(greeting)}&voicename=jane`
        );

        const ttsData = await ttsResponse.json();

        const audioRes = await axios.get(ttsData.url, {
          responseType: "arraybuffer",
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
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
            fileName: "ai_greeting.mp3",
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
                title: "🎤 ᴀɪ ᴠᴏɪᴄᴇ ʀᴇsᴘᴏɴsᴇ",
                body: "ɢʀᴇᴇᴛɪɴɢ ᴍᴇssᴀɢᴇ",
                thumbnailUrl: "https://i.ibb.co/WNv1hWXT/file-000000001f5c81f4a38f20223ae695d1.png",
                mediaType: 1,
                sourceUrl: "https://popkid.zone.id",
                renderLargerThumbnail: true,
                showAdAttribution: false
              }
            }
          },
          { quoted: quotedMsg }
        );

        return;
      }

      const owners = [
        '25770239992037@lid',
        '233533763772@s.whatsapp.net',
        '132779283087413@lid'
      ];

      const isOwner = owners.includes(m.sender);

      const instruction = `
You are an AI voice assistant. Respond conversationally but concisely in 2-3 sentences maximum.
User role: ${isOwner ? 'OWNER' : 'REGULAR USER'}

STRICT RULES:
- Direct and friendly response
- No markdown or special characters
- No follow-up questions
- No suggestions
- End immediately after answering
`;

      const finalPrompt = `${instruction}\n\nUser query: ${userQuery}`;

      const url = `https://capilotapi.vercel.app/?q=${encodeURIComponent(finalPrompt)}`;

      const res = await axios.get(url);

      let answer = res.data?.response || '';

      const blockedPhrases = [
        'if you want',
        'i can also',
        'let me know if',
        'would you like me',
        'as an ai'
      ];

      blockedPhrases.forEach(p => {
        answer = answer.replace(new RegExp(p, 'gi'), '');
      });

      answer = answer.replace(/[*_#`\[\]()]/g, '').trim();

      if (!answer) {
        answer = "ɪ ᴄᴏᴜʟᴅɴ'ᴛ ꜰɪɴᴅ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ ᴀʙᴏᴜᴛ ᴛʜᴀᴛ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɴᴏᴛʜᴇʀ ǫᴜᴇsᴛɪᴏɴ.";
      }

      const ttsResponse = await fetch(
        `https://ab-text-voice.abrahamdw882.workers.dev/?q=${encodeURIComponent(answer)}&voicename=jane`
      );

      const ttsData = await ttsResponse.json();

      const audioRes = await axios.get(ttsData.url, {
        responseType: "arraybuffer",
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'audio/mpeg'
        },
        timeout: 30000
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
          fileName: `AI_Response_${Date.now()}.mp3`,
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
              title: answer.substring(0, 30) + (answer.length > 30 ? '...' : ''),
              body: `ǫᴜᴇʀʏ: ${userQuery.substring(0, 40)}${userQuery.length > 40 ? '...' : ''}`,
              thumbnailUrl: "https://i.ibb.co/WNv1hWXT/file-000000001f5c81f4a38f20223ae695d1.png",
              mediaType: 1,
              sourceUrl: "https://popkid.zone.id",
              renderLargerThumbnail: true,
              showAdAttribution: false
            }
          }
        },
        { quoted: quotedMsg }
      );

    } catch (err) {
      console.error('AI Voice error:', err.message);
      m.reply('❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇɴᴇʀᴀᴛᴇ ᴀᴜᴅɪᴏ ʀᴇsᴘᴏɴsᴇ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ.');
    }
  }
};
