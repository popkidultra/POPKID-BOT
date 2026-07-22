const axios = require('axios');

module.exports = {
name: 'menu',
    hidden: true,
description: 'Show available bot commands',
aliases: ['help', 'cmdlist', 'commands'],

async execute(sock, m) {    
    const prefix = global.BOT_PREFIX || '.';    
    
    const now = new Date();
    
    const date = now.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        timeZone: 'Africa/Accra'
    });
    
    const time = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true,
        timeZone: 'Africa/Accra'
    });
    
    const botOwner = global.ownerName  || 'POPKID';
    
    const user = m.pushName || m.sender?.split('@')[0] || 'User';

    const uptimeSec = process.uptime();
    const uh = Math.floor(uptimeSec / 3600);
    const um = Math.floor((uptimeSec % 3600) / 60);
    const us = Math.floor(uptimeSec % 60);
    const uptimeStr = `${uh}h ${um}m ${us}s`;

    const ramStr = `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`;

    // Box-drawing pieces + accent emoji (swap CAP to change the corner look everywhere at once)
    const CAP = '💠';
    const TOP = `╭──═════════════${CAP}`;
    const MID = `╠──═════════════${CAP}`;
    const BOT = `╰──═════════════${CAP}`;

    // Auto-build the command list from whatever plugins are actually loaded,
    // so new plugins show up here automatically without editing this file.
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
            if (seen.has(plugin.name)) continue; // plugin objects are indexed by name + every alias
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

    const commandSections = allCategories.map(category => {
        const icon = CATEGORY_ICONS[category] || '📂';
        const lines = grouped[category].map(l => `║ ◇ ${l}`).join('\n');
        return `${TOP}\n║ ${icon} *${category.toUpperCase()}*\n${MID}\n║\n${lines}\n║\n${BOT}`;
    }).join('\n\n');

    const menuText = `
${TOP}
║ ✨ *POPKID BOT* ✨
${MID}
║
║ 👤 *OWNER:* ${botOwner}
║ 🙋 *USER:* ${user}
║ 🚀 *PLUGINS:* ${totalPlugins}
║ ⏳ *UPTIME:* ${uptimeStr}
║ 📆 *DATE:* ${date}
║ 📊 *RAM:* ${ramStr}
║ 🔧 *PREFIX:* ${prefix}
║
${BOT}

${commandSections}

© popkid
`.trim();

    try {    
        const imageBuffer = (await axios.get(global.menuImage, { responseType: 'arraybuffer' })).data;    
        
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
        console.error('Menu error:', err);    
        return;
    }    
}

};
