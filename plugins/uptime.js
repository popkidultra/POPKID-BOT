const { cmd } = require('../arslan');
const os = require('os');

cmd({
    pattern: "uptime",
    name: 'uptime',
    category: 'General',
    aliases: ['runtime', 'up', 'status', 'system'],
    description: 'Check advanced bot metrics and server uptime',
    filename: __filename
}, async (sock, m, args) => {
    const start = Date.now();
    const initialMsg = await m.reply('⚡ _Fetching system metrics..._');
    const pingLatency = Date.now() - start;

    // Time conversion utility
    const formatTime = (seconds) => {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const min = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (min > 0) parts.push(`${min}m`);
        parts.push(`${s}s`);
        return parts.join(' ') || '0s';
    };

    // System Metrics
    const botUptime = formatTime(process.uptime());
    const hostUptime = formatTime(os.uptime());

    // RAM Metrics
    const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(2);
    const freeMem = (os.freemem() / (1024 ** 3)).toFixed(2);
    const usedMem = (totalMem - freeMem).toFixed(2);
    const ramUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

    // CPU Metrics
    const cpuModel = os.cpus()[0]?.model || 'Generic Processor';
    const loadAvg = os.loadavg()[0].toFixed(2); // 1-minute load average

    const statusText = `
╭─── System Dashboard ───
│ ⏱️ *Bot Uptime:* ${botUptime}
│ 🖥️ *Host Uptime:* ${hostUptime}
│ 🏓 *Response:* ${pingLatency}ms
├───────────────────────
│ 📊 *RAM Usage:* ${usedMem} GB / ${totalMem} GB (${ramUsagePercent}%)
│ ⚡ *CPU Model:* ${cpuModel}
│ ⚙️ *CPU Load:* ${loadAvg}%
│ 💻 *OS:* ${os.platform()} (${os.arch()})
╰───────────────────────
`.trim();

    await sock.sendMessage(m.from, {
        text: statusText,
        edit: initialMsg.key
    });
});
