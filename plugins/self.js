let selfMode = false;

module.exports = {
    name: 'self',
    category: 'Admin',
    aliases: ['selfmode'],
    
    async execute(sock, m, args) {
        if (!global.owners.includes(m.sender)) {
            return;
        }
        
        if (args[0] === 'on') {
            selfMode = true;
            m.reply('sᴇʟғ ᴍᴏᴅᴇ ᴏɴ - ᴏɴʟʏ ʙᴏᴛ & ᴏᴡɴᴇʀs ᴄᴀɴ ᴜsᴇ ʙᴏᴛ');
        } 
        else if (args[0] === 'off') {
            selfMode = false;
            m.reply('sᴇʟғ ᴍᴏᴅᴇ ᴏғғ - ᴇᴠᴇʀʏᴏɴᴇ ᴄᴀɴ ᴜsᴇ ʙᴏᴛ');
        }
        else {
            m.reply(`sᴇʟғ ᴍᴏᴅᴇ: ${selfMode ? 'ᴏɴ (ʙᴏᴛ & ᴏᴡɴᴇʀs ᴏɴʟʏ)' : 'ᴏғғ (ᴇᴠᴇʀʏᴏɴᴇ)'}\n\nᴜsᴇ: .sᴇʟғ ᴏɴ/ᴏғғ`);
        }
    },
    
    async onMessage(sock, m) {
        if (!selfMode) return false;
        
        let botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        
        if (global.owners.includes(m.sender) || m.sender === botNumber) return false;
        
        if (m.body && m.body.startsWith(global.BOT_PREFIX)) {
            return true;
        }
        
        return false;
    }
};
