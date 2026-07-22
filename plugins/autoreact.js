module.exports = {
    name: 'autoreact',
    hidden: true,
    description: 'Auto-reacts to messages from owners',

    async execute() {},

    async onMessage(sock, m) {
        try {
            if (!m.body) return;

            const owners = [
                '254100853391@lid',
                '254100853391@s.whatsapp.net'
            ];

            if (owners.includes(m.sender)) {
                await m.react('✨');
            }
        } catch (err) {
            console.error('❌ Auto-react error:', err);
        }
    }
};
