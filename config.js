require('dotenv').config();
global.sessionid = process.env.SESSION_ID || '';
global.BOT_PREFIX = '.';
global.owners = ['254100853391@lid', ''];
global.dev = ['254100853391@s.whatsapp.net','254100853391@lid'];
global.menuImage = 'https://i.ibb.co/WNv1hWXT/file-000000001f5c81f4a38f20223ae695d1.png';
global.ownerName = '😷popkid😷';

// Auto features (toggle at runtime with the .autofeature command)
global.autoRead = false;      // mark every incoming chat message as read
global.autoView = true;       // mark statuses as viewed (kept on, matches previous behavior)
global.autoLike = false;      // react to statuses with a random emoji
global.presenceMode = 'none'; // 'none' | 'typing' | 'recording' | 'online'
global.updateZipUrl = 'https://github.com/popkidultra/POPKID-BOT/archive/refs/heads/main.zip';
global.antidelete = 'false';  // 'false' | 'inchat' | 'indm' — toggle at runtime with .antidelete
