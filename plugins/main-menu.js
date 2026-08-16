const axios = require('axios');
const { cmd } = require('../arslan');

cmd({
    pattern: "menu",
    name: 'menu',
    hidden: true,
    description: 'Show available bot commands',
    aliases: ['help', 'cmdlist', 'commands'],
    filename: __filename
}, async (sock, m) => {    
    const prefix = global.BOT_PREFIX || '.';    
    const now = new Date();
    
    const date = now.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        timeZone: 'Africa/Accra'
    });
    
    const botOwner = global.ownerName || 'popkid';
    const user = m.pushName || m.sender?.split('@')[0] || 'User';

    const uptimeSec = process.uptime();
    const uh = Math.floor(uptimeSec / 3600);
    const um = Math.floor((uptimeSec % 3600) / 60);
    const us = Math.floor(uptimeSec % 60);
    const uptimeStr = `${uh}h ${um}m ${us}s`;

    const ramStr = `${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)}MB`;

    const CATEGORY_ORDER = ['General', 'Downloaders', 'Tools', 'AI', 'Fun', 'Group', 'Status', 'Channel', 'Admin'];
    const CATEGORY_ICONS = {
        General: '📜', Downloaders: '💼', Tools: '🛠️', AI: '🧠', Fun: '🎉',
        Group: '👥', Status: '📡', Channel: '📢', Admin: '👑'
    };

    const grouped = {};
    const seen = new Set();
    let totalPlugins = 0;

    if (global.plugins instanceof Map) {
        const uniquePlugins = new Set(global.plugins.values());
        totalPlugins = uniquePlugins.size;

        for (const plugin of global.plugins.values()) {
            if (!plugin || !plugin.name) continue;
            if (plugin.hidden) continue;
            if (seen.has(plugin.name)) continue;
            seen.add(plugin.name);

            const category = plugin.category || 'General';
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(`${prefix}${plugin.name}`);
        }
    }

    const allCategories = [
        ...CATEGORY_ORDER.filter(c => grouped[c]),
        ...Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c))
    ];

    // Perfectly Aligned Main Header Box
    const headerBox = `
╔════ 👑 POPKID BOT ════╗
║ 👤 Owner: ${botOwner}
║ 🙋 User: ${user}
║ 🚀 Plugins: ${totalPlugins}
║ ⏱️ Uptime: ${uptimeStr}
║ 📅 Date: ${date}
║ 📊 RAM: ${ramStr}
║ 🔧 Prefix: ${prefix}
╚═══════════════════════╝
`.trim();

    // Perfectly Aligned Category Boxes
    const commandSections = allCategories.map(category => {
        const icon = CATEGORY_ICONS[category] || '📂';
        const lines = grouped[category].map(l => `║ ❯ ${l}`).join('\n');
        return `╔════ ${icon} POPKID ${category.toUpperCase()} ════╗\n${lines}\n╚═══════════════════════════╝`;
    }).join('\n\n');

    const menuText = `${headerBox}\n\n${commandSections}\n\n> Powered by Popkid Bot`;

    try {    
        if (!global.menuImage) throw new Error('global.menuImage is not set');

        const imageBuffer = (await axios.get(global.menuImage, {
            responseType: 'arraybuffer',
            timeout: 8000
        })).data;    
        
        await m.reply(imageBuffer, { 
            caption: menuText,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363426778975572@newsletter',
                    newsletterName: '😷popkid😷',
                    serverMessageId: 1
                }
            }
        });
        
    } catch (err) {    
        console.error('Menu image error, falling back to text:', err.message);
        try {
            await m.reply(menuText);
        } catch (err2) {
            console.error('Menu fallback error:', err2.message);
        }
    }    
});
