const { cmd } = require('../arslan');

const autoEmojis = [
    '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '❤️',
    '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '♥️',
    '🎈', '🎁', '💌', '💐', '😘', '🤗',
    '🌸', '🌹', '🥀', '🌺', '🌼', '🌷',
    '🍁', '⭐️', '🌟', '😊', '🥰', '😍',
    '🤩', '☺️'
];

let autoReact = false;
let lastReactedTime = 0;
const REACT_THROTTLE_MS = 2000;

function random(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

const registered = cmd({
    pattern: "autoreact",
    name: 'autoreact',
    category: 'Admin',
    aliases: ['areact'],
    description: 'Toggle auto-react to incoming messages',
    filename: __filename
}, async (sock, m, args) => {
    if (!global.owners.includes(m.sender)) {
        return;
    }

    const val = (args[0] || '').toLowerCase();

    if (val !== 'on' && val !== 'off') {
        return m.reply(
            `ᴀᴜᴛᴏ-ʀᴇᴀᴄᴛ: ${autoReact ? 'ᴏɴ' : 'ᴏғғ'}\n\nᴜsᴇ: .autoreact on/off`
        );
    }

    autoReact = val === 'on';
    m.reply(autoReact ? '*✅ Auto-react enabled*' : '*❌ Auto-react disabled*');
});

// Hooked into the same onMessage pipeline index.js already runs every
// non-command message through (see plugins/self.js for the same pattern).
registered.onMessage = async (sock, m) => {
    if (!autoReact) return false;
    if (!m.body) return false;

    // Skip anything that looks like a command trigger for any prefix style.
    if (/^[!#.$%^&*+=?<>]/.test(m.body)) return false;

    const now = Date.now();
    if (now - lastReactedTime < REACT_THROTTLE_MS) return false;

    try {
        await sock.sendMessage(m.from, {
            react: {
                text: random(autoEmojis),
                key: m.key
            }
        });
        lastReactedTime = now;
    } catch (err) {
        console.error('❌ Auto-react error:', err.message);
    }

    return false;
};
