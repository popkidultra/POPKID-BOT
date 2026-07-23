const fs = require('fs');
const path = require('path');

async function getRealJid(sock, id) {
    if (!id.includes('@lid')) return id;
    
    const groups = await sock.groupFetchAllParticipating();
    for (const group of Object.values(groups)) {
        const participant = group.participants.find(p => p.id === id);
        if (participant?.phoneNumber) {
            return participant.phoneNumber;
        }
    }
    return id;
}

function loadOwners() {
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            global.owners = config.owners || [];
        } else {
            global.owners = [];
        }
    } catch(e) {
        global.owners = [];
    }
}

function saveOwners() {
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        let config = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        config.owners = global.owners;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch(e) {}
}

loadOwners();

module.exports = {
    name: 'owner',
    category: 'Admin',
    aliases: ['owners', 'addowner', 'removeowner', 'delowner'],
    
    async execute(sock, m, args) {
        const command = args[0]?.toLowerCase();
        
        let target = null;
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            target = m.mentionedJid[0];
        } else if (args[1]) {
            let input = args[1];
            if (/^\d+$/.test(input)) {
                target = input + '@s.whatsapp.net';
            } else {
                target = input;
            }
        } else if (m.quoted) {
            target = m.quoted.sender;
        }
        
        if (!command || command === 'list') {
            if (!global.owners || global.owners.length === 0) {
                return m.reply('No owners configured yet.');
            }
            let list = '*👑 Bot Owners*\n\n';
            global.owners.forEach((owner, i) => {
                const number = owner.split('@')[0];
                list += `${i+1}. ${number}\n`;
            });
            return m.reply(list);
        }
        
        const isOwner = global.owners?.includes(m.sender) || global.owners?.includes(m.sender.replace('@lid', '@s.whatsapp.net'));
        if (!isOwner) {
            return m.reply('❌ Only owners can use this command');
        }
        
        if (command === 'add') {
            if (!target) {
                return m.reply(`Usage: ${global.BOT_PREFIX}owner add @user or 254100853391`);
            }
            
            const realJid = await getRealJid(sock, target);
            
            if (global.owners.includes(realJid)) {
                return m.reply('⚠️ User is already an owner');
            }
            
            global.owners.push(realJid);
            saveOwners();
            
            await m.reply(`✅ Added ${realJid.split('@')[0]} as owner`);
        }
        
        else if (command === 'remove' || command === 'del') {
            if (!target) {
                return m.reply(`Usage: ${global.BOT_PREFIX}owner remove @user`);
            }
            
            const realJid = await getRealJid(sock, target);
            
            if (realJid === m.sender || realJid === m.sender.replace('@lid', '@s.whatsapp.net')) {
                return m.reply('❌ You cannot remove yourself');
            }
            
            if (!global.owners.includes(realJid)) {
                return m.reply('⚠️ User is not an owner');
            }
            
            global.owners = global.owners.filter(id => id !== realJid);
            saveOwners();
            
            await m.reply(`✅ Removed ${realJid.split('@')[0]} from owners`);
        }
        
        else {
            m.reply(`*Owner Commands:*\n\n${global.BOT_PREFIX}owner list - Show all owners\n${global.BOT_PREFIX}owner add @user - Add owner\n${global.BOT_PREFIX}owner remove @user - Remove owner`);
        }
    }
};
