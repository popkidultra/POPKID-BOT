const { cmd } = require('../arslan');
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../data/menuimage.json');
const LOCAL_IMAGE_PATH = path.join(__dirname, '../data/menu-image.jpg');

function saveSetting(value) {
    try {
        const dataDir = path.dirname(SETTINGS_PATH);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ menuImage: value }, null, 2));
    } catch (error) {
        console.error('Error saving menu image setting:', error.message);
    }
}

// Re-apply a saved menu image on every boot, since config.js always resets
// global.menuImage to its hardcoded default when it's required in index.js.
(function restoreOnLoad() {
    try {
        if (!fs.existsSync(SETTINGS_PATH)) return;
        const saved = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
        if (saved?.menuImage) global.menuImage = saved.menuImage;
    } catch (error) {
        console.error('Error restoring menu image setting:', error.message);
    }
})();

cmd({
    pattern: "setmenuimg",
    name: 'setmenuimg',
    category: 'Admin',
    aliases: ['setmenupic', 'menuimg'],
    description: 'Change the picture shown on the .menu command',
    filename: __filename
}, async (sock, m, args) => {
    if (!global.owners.includes(m.sender)) {
        return;
    }

    const urlArg = args[0];

    // Case 1: replying to an image
    if (m.quoted && m.quoted.isMedia && m.quoted.type === 'imageMessage') {
        try {
            const buffer = await m.quoted.download();
            const dataDir = path.dirname(LOCAL_IMAGE_PATH);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(LOCAL_IMAGE_PATH, buffer);

            global.menuImage = LOCAL_IMAGE_PATH;
            saveSetting(LOCAL_IMAGE_PATH);

            return m.reply('✅ Menu picture updated from the quoted image.');
        } catch (err) {
            console.error('setmenuimg download error:', err.message);
            return m.reply('❌ Failed to save the quoted image.');
        }
    }

    // Case 2: a direct URL
    if (urlArg && /^https?:\/\//i.test(urlArg)) {
        global.menuImage = urlArg;
        saveSetting(urlArg);
        return m.reply('✅ Menu picture updated from the given URL.');
    }

    return m.reply(
        `*USAGE*\n\n` +
        `• Reply to an image with ${global.BOT_PREFIX}setmenuimg\n` +
        `• Or: ${global.BOT_PREFIX}setmenuimg <image-url>`
    );
});
