const { cmd } = require('../arslan');

cmd({
    pattern: "tagme",
    name: 'tagme',
    category: 'Group',
    aliases: ['tag'],
    description: 'Tag yourself using your WhatsApp JID.',
    filename: __filename
}, async (sock, m) => {
        const jid = m.sender;
        await sock.sendMessage(m.from, {
            text: `@${jid.split('@')[0]}`,
            mentions: [jid]
        });
    });
