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
    const initialMsg = await m.reply('⚡ 𝗣𝗢𝗣𝗞𝗜𝗗 𝗕𝗢𝗧 _fetching..._');
    const pingLatency = Date.now() - start;

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

    const botUptime = formatTime(process.uptime());
    const hostUptime = formatTime(os.uptime());

    const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(1);
    const freeMem = (os.freemem() / (1024 ** 3)).toFixed(1);
    const usedMem = (totalMem - freeMem).toFixed(1);
    const ramUsagePercent = ((usedMem / totalMem) * 100).toFixed(0);

    // Clean CPU name so it fits inside the narrow box
    let cpuModel = os.cpus()[0]?.model || 'CPU';
    cpuModel = cpuModel.replace(/\(R\)|\(TM\)|Intel|AMD|CPU|v\d+/gi, '').replace(/@.*/, '').trim();

    const loadAvg = os.loadavg()[0].toFixed(1);

    const statusText = `
╔═ 👑 𝗣𝗢𝗣𝗞𝗜𝗗 𝗕𝗢𝗧 ═╗
║ ⏱️ 𝗨𝗽: ${botUptime}
║ 🖥️ 𝗛𝗼𝘀𝘁: ${hostUptime}
║ 🏓 𝗣𝗶𝗻𝗴: ${pingLatency}ms
╠═════════════════╣
║ 📊 𝗥𝗔𝗠: ${usedMem}/${totalMem}GB (${ramUsagePercent}%)
║ ⚡ 𝗖𝗣𝗨: ${cpuModel}
║ ⚙️ 𝗟𝗼𝗮𝗱: ${loadAvg}%
║ 💻 𝗢𝗦: ${os.platform()}
╚═════════════════╝
> 𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 𝗣𝗼俱𝗶𝗱 𝗕𝗼𝘁
`.trim();

    await sock.sendMessage(m.from, {
        text: statusText,
        edit: initialMsg.key
    });
});
