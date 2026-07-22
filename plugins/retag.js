module.exports = {
    name: 'retag',
    category: 'Tools',
    aliases: ['rt'],

    async execute(sock, m, args) {

        const mentioned =
            m.message?.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid?.[0]
            ||
            m.quoted?.message?.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid?.[0];

        if (!mentioned) {
            return m.reply('Tag someone');
        }

        await sock.sendMessage(m.from, {
            text: '@' + mentioned.split('@')[0],
            mentions: [mentioned]
        });
    }
};
