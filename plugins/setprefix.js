const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'setprefix',
    category: 'Admin',
    aliases: ['prefix', 'changeprefix'],
    description: 'Change the command prefix (Owner only)',

    async execute(sock, m, args) {
        if (!global.owners.includes(m.sender)) {
            return m.reply('❌ You are not allowed to change the prefix.');
        }

        if (!args[0]) {
            return m.reply(`📝 Usage: ${global.BOT_PREFIX}setprefix <newPrefix>\nExample: ${global.BOT_PREFIX}setprefix !`);
        }

        const newPrefix = args[0];
        
        if (newPrefix.length > 3) {
            return m.reply('❌ Prefix must be 3 characters or less.');
        }

        global.BOT_PREFIX = newPrefix;

        try {
            const configPath = path.join(__dirname, '../config.json');
            let config = {};
            
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, 'utf8');
                config = JSON.parse(data);
            }
            
            config.prefix = newPrefix;
            
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
            console.log(`✅ Prefix saved to config.json: ${newPrefix}`);
        } catch (error) {
            console.error('❌ Error saving prefix to config:', error);
            return m.reply('❌ Error saving prefix to config file.');
        }

        for (const owner of global.owners) {
            try {
                await sock.sendMessage(owner, { 
                    text: `⚙️ *Prefix Updated*\n\nNew prefix: \`${newPrefix}\`\nChanged by: @${m.sender.split('@')[0]}\nTime: ${new Date().toLocaleTimeString()}`
                });
            } catch (err) {
                console.error(`Could not notify owner ${owner}:`, err);
            }
        }

        return m.reply(`✅ Prefix successfully changed to: \`${newPrefix}\``);
    }
};
