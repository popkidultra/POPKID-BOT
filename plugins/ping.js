const { cmd } = require('../arslan');

cmd({
    pattern: "ping",
    name: 'ping',
    category: 'General',
    aliases: ['p', 'pong'],
    description: 'Check bot response time',
    filename: __filename
}, async (sock, m, args) => {
    const start = Date.now();
    const sent = await m.reply('Pinging...');
    const latency = Date.now() - start;

    await sock.sendMessage(m.from, {
        text: `🏓 Pong!\nLatency: ${latency}ms`,
        edit: sent.key
    });
});
