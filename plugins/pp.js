module.exports = {
  name: 'profilepic',
    category: 'Tools',
  description: 'Get profile picture',
  aliases: ['pp', 'dp'],
  tags: ['tools'],
  command: /^\.?(profilepic|pp|dp)/i,

  async execute(sock, m) {
    try {
      const jid = m.quoted?.key?.participant || m.sender

      let ppUrl
      try {
        ppUrl = await sock.profilePictureUrl(jid, 'image')
      } catch {
        ppUrl = await sock.profilePictureUrl(jid, 'preview')
      }

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
      }

      await sock.sendMessage(
        m.from,
        {
          image: { url: ppUrl },
          caption: 'Profile picture',
          contextInfo: {
            forwardedNewsletterMessageInfo: {
              newsletterJid: '120363426778975572@newsletter',
              newsletterName: '😷popkid😷'
            },
            isForwarded: true,
            externalAdReply: {
              title: '𝗣𝗢𝗣𝗞𝗜𝗗',
              body: 'Powered by popkid Tech',
              thumbnailUrl: ppUrl,
              mediaType: 1,
              mediaUrl: 'https://popkid.my.id',
              sourceUrl: 'https://popkid.my.id',
              showAdAttribution: true
            }
          }
        },
        { quoted: quotedMsg }
      )

    } catch (err) {
      console.error('Profile pic error:', err)
      m.reply('Failed to fetch profile picture.')
    }
  }
}
