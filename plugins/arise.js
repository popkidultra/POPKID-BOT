const axios = require('axios');

module.exports = {
    name: 'autorise',
    hidden: true,
    description: 'Auto reply when a message *starts with* trigger keywords like "arise", "test", "bot", etc.',

    async execute() {},

    async onMessage(sock, m) {
        if (m.isBot || !m.text) return;

        const text = m.text.trim().toLowerCase();
        const triggers = ['arise', 'rise'];
        const isTriggered = triggers.some(word => text.startsWith(word));

        if (isTriggered) {
            const sentMsg = await m.reply('I have risen...');

            setTimeout(async () => {
                try {
                    await sock.sendMessage(m.from, {
                        text: '*BOT ACTIVE AND RUNNING...*',
                        edit: sentMsg.key
                    });
                } catch (err) {
                    console.error('Autorise error:', err);
                }
            }, 1000);
        }
    }
};
