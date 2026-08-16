const { cmd } = require('../arslan');
const os = require('os');

cmd({
    pattern: "uptime",
    name: 'uptime',
    category: 'General',
    aliases: ['runtime', 'up', 'status', 'popkid'],
    description: 'Check Popkid Bot runtime and server metrics',
    filename: __filename
}, async (sock, m, args) => {
    const start = Date.now();
    const initialMsg = await m.reply('⚡ 𝗣𝗢𝗣𝗞𝗜𝗗 𝗕𝗢𝗧 _fetching system metrics..._');
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
    const loadAvg = os.loadavg()[0].toFixed(2);

    const statusText = `
╔═════ 👑 𝗣𝗢𝗣𝗞𝗜𝗗 𝗕𝗢𝗧 𝗦𝗧𝗔𝗧𝗨𝗦 ═════╗
║ ⏱️ 𝗕𝗼𝘁 𝗨𝗽𝘁𝗶𝗺𝗲: ${botUptime}
║ 🖥️ 𝗛𝗼𝘀𝘁 𝗨𝗽𝘁𝗶𝗺𝗲: ${hostUptime}
║ 🏓 𝗥𝗲𝘀𝗽𝗼𝗻𝘀𝗲: ${pingLatency}ms
╠═════════════════════════════════╣
║ 📊 𝗥𝗔𝗠 𝗨𝘀𝗮𝗴𝗲: ${usedMem} GB / ${totalMem} GB (${ramUsagePercent}%)
║ ⚡ 𝗖𝗣𝗨 𝗠𝗼𝗱𝗲𝗹: ${cpuModel}
║ ⚙️ 𝗖𝗣𝗨 𝗟𝗼𝗮𝗱: ${loadAvg}%
║ 💻 𝗢𝗦: ${os.platform()} (${os.arch()})
╚═════════════════════════════════╝
> 𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 𝗣𝗼𝗽𝗸𝗶𝗱 𝗕𝗼𝘁
`.trim();

    await sock.sendMessage(m.from, {
        text: statusText,
        edit: initialMsg.key
    });
});
