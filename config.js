require('dotenv').config();
global.sessionid = process.env.SESSION_ID || '';
global.BOT_PREFIX = '.';
global.owners = ['254100853391@lid', ''];
global.dev = ['254100853391@s.whatsapp.net','254100853391@lid'];
global.menuImage = 'https://i.ibb.co/JRJKvBrv/file-00000000689c8243bee3d05752b799c8.png';
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
