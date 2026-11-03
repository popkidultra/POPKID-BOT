require('dotenv').config();
global.sessionid = process.env.SESSION_ID || '';
global.BOT_PREFIX = '.';
global.owners = ['254100853391@lid', ''];
global.dev = ['254100853391@s.whatsapp.net','254100853391@lid'];
global.menuImage = 'https://i.ibb.co/GQNSbb6D/IMG-20260921-WA0012.jpg';
global.ownerName = '😷popkid😷';

// Auto features (toggle at runtime with the .autofeature command)
global.autoRead = false;      // mark every incoming chat message as read
global.autoView = true;       // mark statuses as viewed (kept on, matches previous behavior)
global.autoLike = false;      // react to statuses with a random emoji
global.statusReactThrottleMs = 5000; // min ms between status reactions (prevents burst-spam)
global.statusReactDelayMs = 2000;    // pause after reacting before handling the next status
global.presenceMode = 'none'; // 'none' | 'typing' | 'recording' | 'online'
global.updateZipUrl = 'https://github.com/popkidultra/POPKID-BOT/archive/refs/heads/main.zip';
global.antidelete = 'false';  // 'false' | 'inchat' | 'indm' — toggle at runtime with .antidelete
global.highlightlyKey = process.env.HIGHLIGHTLY_API_KEY || 'c9f43957-7720-4845-a2c0-ee992f1c5244';

// "View channel" tag on every bot reply (applied once in index.js, no per-command edits)
global.channelTag = true;                          // set false to turn it off
global.channelJid = '120363426692424154@newsletter';
global.channelName = 'Popkid';

// Fake "© Popkid Md" contact-card quote above every reply (set false to turn off)
global.fakeQuote = true;
global.botDisplayName = 'Popkid Md';

// Image sent with the "POPKID BOT CONNECTED" message
global.connectedImage = 'https://i.ibb.co/Fk5sQt5x/44b393028697de9d9f52e2d49a86d018.jpg';
