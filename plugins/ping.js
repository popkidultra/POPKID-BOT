module.exports = {
    name: 'ping',
    category: 'General',
    aliases: ['pong', 'latency'],
    description: 'Check bot response speed and connection health',

    async execute(sock, m, args) {
        // --- 1. Start timer and send loading message ---
        const start = Date.now();
        const loadingMsg = await m.reply('🏓 *Pinging...*');

        // --- 2. Get WebSocket ping (if available) ---
        let wsPing = 'N/A';
        if (sock.ws && typeof sock.ws.ping === 'number') {
            wsPing = sock.ws.ping + ' ms';
        } else if (sock.ws && sock.ws._socket && sock.ws._socket._pingRTT) {
            // Some Baileys versions store RTT differently
            wsPing = sock.ws._socket._pingRTT + ' ms';
        }

        // --- 3. Calculate bot latency ---
        const latency = Date.now() - start;

        // --- 4. Calculate uptime (in a human-readable format) ---
        const uptimeSeconds = process.uptime();
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);
        let uptimeStr = '';
        if (days) uptimeStr += `${days}d `;
        if (hours) uptimeStr += `${hours}h `;
        if (minutes) uptimeStr += `${minutes}m `;
        uptimeStr += `${seconds}s`;

        // --- 5. Build the response message ---
        const statusEmoji = latency < 200 ? '🟢' : latency < 500 ? '🟡' : '🔴';
        const info = 
`┌─── *🏓 PONG !* ───┐
│
│  ${statusEmoji} *Bot Latency* : ${latency} ms
│  📡 *WebSocket Ping* : ${wsPing}
│  ⏱️ *Uptime*        : ${uptimeStr}
│
└─── *PopKid MD* ───┘`;

        // --- 6. Edit the loading message with the result ---
        try {
            await sock.sendMessage(m.from, {
                text: info,
                edit: loadingMsg.key
            });
        } catch (err) {
            console.error('Ping edit error:', err);
            // Fallback: send a new message if editing fails
            await sock.sendMessage(m.from, { text: `🏓 Pong! Latency: ${latency} ms` });
        }
    }
};
