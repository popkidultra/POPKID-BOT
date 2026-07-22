const axios = require('axios');

module.exports = {
  name: 'tweet',
    category: 'Fun',
  description: 'Create a tweet image with your comment',
  aliases: ['twitter', 'tweetcom'],
  tags: ['maker', 'image'],
  command: /^\.?(tweet|twitter|tweetcom)/i,

  async execute(sock, m, args) {
    try {
      if (!args[0]) {
        return m.reply("ᴜsᴀɢᴇ:\n.tweet <ʏᴏᴜʀ ᴄᴏᴍᴍᴇɴᴛ>\nᴇxᴀᴍᴘʟᴇ: .tweet ʜᴇʟʟᴏ ᴡᴏʀʟᴅ!");
      }

      await m.reply("⭐ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ... ɢᴇɴᴇʀᴀᴛɪɴɢ ʏᴏᴜʀ ᴛᴡᴇᴇᴛ ɪᴍᴀɢᴇ.");

      const text = args.join(" ").trim();

      let avatar = 'https://i.ibb.co/WNv1hWXT/file-000000001f5c81f4a38f20223ae695d1.png';
      try {
        const ppUrl = await sock.profilePictureUrl(m.sender, 'image');
        if (ppUrl) avatar = ppUrl;
      } catch (err) {
        console.log('Using default avatar');
      }

      const displayName = m.pushName || m.sender.split('@')[0];
      const username = m.sender.split('@')[0];

      const replies = '69';
      const retweets = '69';
      const theme = 'dark';

      const url = `https://some-random-api.com/canvas/misc/tweet?displayname=${encodeURIComponent(displayName)}&username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}&comment=${encodeURIComponent(text)}&replies=${encodeURIComponent(replies)}&retweets=${encodeURIComponent(retweets)}&theme=${encodeURIComponent(theme)}`;

      const imageRes = await axios.get(url, {
        responseType: "arraybuffer"
      });

      const buffer = Buffer.from(imageRes.data);

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
          image: buffer,
          caption: `*ᴛʜᴀɴᴋs ғᴏʀ ᴛᴡᴇᴇᴛɪɴɢ*\n\n👤 *ᴜsᴇʀ:* @${username}\n *ᴛᴡᴇᴇᴛ:* ${text}\n✨ *ʀᴇᴘʟɪᴇs:* ${replies}  |  *ʀᴇᴛᴡᴇᴇᴛs:* ${retweets}`,
          mentions: [m.sender],
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: '120363426778975572@newsletter',
              newsletterName: '😷popkid😷',
              serverMessageId: 1
            },
            externalAdReply: {
              title: "🐦 ᴛᴡᴇᴇᴛ ɢᴇɴᴇʀᴀᴛᴏʀ",
              body: `@${username}: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`,
              thumbnailUrl: avatar,
              mediaType: 1,
              sourceUrl: "https://twitter.com",
              renderLargerThumbnail: true,
              showAdAttribution: false
            }
          }
        },
        { quoted: quotedMsg }
      );

    } catch (err) {
      console.error('Tweet plugin error:', err.message);
      m.reply('❌ ғᴀɪʟᴇᴅ ᴛᴏ ɢᴇɴᴇʀᴀᴛᴇ ᴛᴡᴇᴇᴛ ɪᴍᴀɢᴇ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.');
    }
  }
};
