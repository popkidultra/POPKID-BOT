const axios = require('axios');
const { cmd } = require('../arslan');

// Helper function to convert standard text to Mathematical Bold Font
const toBoldFont = (str) => {
    const normal = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bold   = "𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵";
    return str.split('').map(char => {
        const index = normal.indexOf(char);
        return index !== -1 ? bold[index] : char;
    }).join('');
};

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
        year: '2-digit',
        timeZone: 'Africa/Accra'
    });
    
    const botOwner = global.ownerName || 'popkid';
    const user = m.pushName || m.sender?.split('@')[0] || 'User';

    const uptimeSec = process.uptime();
    const uh = Math.floor(uptimeSec / 3600);
    const um = Math.floor((uptimeSec % 3600) / 60);
    const us = Math.floor(uptimeSec % 60);
    const uptimeStr = `${uh}h ${um}m ${us}s`;

    const ramStr = `${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)}MB`;

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

    // Header Box with Bold Fonts
    const headerBox = `
╔═ 👑 𝗣𝗢𝗣𝗞𝗜𝗗 ═╗
║ 👤 𝗢𝘄𝗻𝗲𝗿: ${botOwner}
║ 🙋 𝗨𝘀𝗲𝗿: ${user}
║ 🚀 𝗖𝗺𝗱𝘀: ${totalPlugins}
║ ⏱️ 𝗨𝗽: ${uptimeStr}
║ 📅 𝗗𝗮𝘁𝗲: ${date}
║ 📊 𝗥𝗔𝗠: ${ramStr}
║ 🔧 𝗣𝗿𝗲𝗳: ${prefix}
╚══════════════╝
`.trim();

    // Category Boxes with Bold Category Names
    const commandSections = allCategories.map(category => {
        const icon = CATEGORY_ICONS[category] || '📂';
        const boldCategoryName = toBoldFont(category.toUpperCase());
        const lines = grouped[category].map(l => `║ ❯ ${l}`).join('\n');
        return `╔═ ${icon} 𝗣𝗢𝗣𝗞𝗜𝗗 ${boldCategoryName} ═╗\n${lines}\n╚══════════════╝`;
    }).join('\n\n');

    const menuText = `${headerBox}\n\n${commandSections}\n\n> 𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 𝗣𝗼𝗽𝗸𝗶𝗱 𝗕𝗼𝘁`;

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
