module.exports = {
    name: 'tagall',
    category: 'Group',
    aliases: ['everyone'],
    description: 'Tag everyone in the group',

    async execute(sock, m) {
        if (!m.isGroup) {
            return await m.reply('ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ɪɴ ɢʀᴏᴜᴘs!')
        }

        if (!m.isOwner && !m.isAdmin) {
            return await m.reply('ᴏɴʟʏ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴs ᴏʀ ᴏᴡɴᴇʀs ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!')
        }

        const participants = Array.isArray(m.groupMetadata?.participants)
            ? m.groupMetadata.participants.map(p => p.id)
            : []

        if (!participants.length) {
            return await m.reply('❌ Nᴏ ɢʀᴏᴜᴘ ᴘᴀʀᴛɪᴄɪᴘᴀɴᴛs ғᴏᴜɴᴅ.')
        }

        const mentionText = participants
            .map(p => `@${p.split('@')[0]}`)
            .join('\n')

        const message = `👋 ʜᴇʟʟᴏ ᴇᴠᴇʀʏᴏɴᴇ!
ʜᴇʀᴇ ᴀʀᴇ ᴛʜᴇ ɢʀᴏᴜᴘ ᴍᴇᴍʙᴇʀs:

${mentionText}`

        await m.send({
            text: message,
            mentions: participants
        })
    }
}
