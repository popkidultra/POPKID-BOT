const fs = require('fs');

module.exports = {
    name: 'group',
    category: 'Group',
    description: 'Manage group settings',
    aliases: ['gsettings', 'grup', 'gc'],
    tags: ['group'],
    command: /^\.?(group|gsettings|grup|gc)$/i,

    async execute(sock, m, args) {
        try {
            if (!m.isGroup) {
                return await m.reply('ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ɪɴ ɢʀᴏᴜᴘs!');
            }

            if (!m.isOwner && !m.isAdmin) {
                return await m.reply('ᴏɴʟʏ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴs ᴏʀ ᴏᴡɴᴇʀs ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!');
            }
            
            if (!args.length) {
                const currentName = m.groupMetadata?.subject || 'ᴜɴᴋɴᴏᴡɴ';
                const currentDesc = m.groupMetadata?.desc?.toString() || 'ɴᴏ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ';
                const memberCount = m.groupMetadata?.participants?.length || 0;
                const isMuted = m.groupMetadata?.announce || false;
                
                const infoText = `
*ɢʀᴏᴜᴘ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ*

ᴛɪᴛʟᴇ: ${currentName}
ᴍᴇᴍʙᴇʀꜱ: ${memberCount}
ᴍᴜᴛᴇ ꜱᴛᴀᴛᴜꜱ: ${isMuted ? 'ᴍᴜᴛᴇᴅ (ᴏɴʟʏ ᴀᴅᴍɪɴꜱ)' : 'ᴜɴᴍᴜᴛᴇᴅ (ᴇᴠᴇʀʏᴏɴᴇ)'}
ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ: ${currentDesc.substring(0, 100)}

ᴜꜱᴀɢᴇ:
.ɢʀᴏᴜᴘ ɴᴀᴍᴇ <ᴛᴇxᴛ>
.ɢʀᴏᴜᴘ ᴅᴇꜱᴄ <ᴛᴇxᴛ>
.ɢʀᴏᴜᴘ ᴍᴜᴛᴇ
.ɢʀᴏᴜᴘ ᴜɴᴍᴜᴛᴇ
.ɢʀᴏᴜᴘ ʀᴇꜱᴇᴛ

> ᴜꜱᴇ ᴛʜᴇꜱᴇ ᴄᴏᴍᴍᴀɴᴅꜱ ᴛᴏ ᴍᴀɴᴀɢᴇ ʏᴏᴜʀ ɢʀᴏᴜᴘ
                `.trim();
                
                await m.reply(infoText);
                return;
            }
            
            const command = args[0].toLowerCase();
            const text = args.slice(1).join(' ');
            
            if (command === 'name') {
                if (!text) {
                    await m.reply(`❌ ᴇʀʀᴏʀ 
    
ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴇᴡ ɢʀᴏᴜᴘ ɴᴀᴍᴇ`);
                    return;
                }
                
                await sock.groupUpdateSubject(m.from, text);
                
                const successText = `
✅ *ꜱᴜᴄᴄᴇꜱꜱ*

ɢʀᴏᴜᴘ ɴᴀᴍᴇ ᴄʜᴀɴɢᴇᴅ

ᴏʟᴅ: ${m.groupMetadata?.subject}
ɴᴇᴡ: ${text}
                `.trim();
                
                await m.reply(successText);
            } 
            else if (command === 'desc') {
                if (!text) {
                    await m.reply(`❌ ᴇʀʀᴏʀ 
    
ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴇᴡ ɢʀᴏᴜᴘ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ`);
                    return;
                }
                
                await sock.groupUpdateDescription(m.from, text);
                
                const successText = `
✅ *ꜱᴜᴄᴄᴇꜱꜱ*

ɢʀᴏᴜᴘ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ ᴄʜᴀɴɢᴇᴅ

ɴᴇᴡ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ:
${text.substring(0, 100)}
                `.trim();
                
                await m.reply(successText);
            }
            else if (command === 'mute') {
                await sock.groupSettingUpdate(m.from, 'announcement');
                
                const successText = `
✅ *ꜱᴜᴄᴄᴇꜱꜱ*

ɢʀᴏᴜᴘ ʜᴀꜱ ʙᴇᴇɴ ᴍᴜᴛᴇᴅ

ᴏɴʟʏ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ꜱᴇɴᴅ ᴍᴇꜱꜱᴀɢᴇꜱ
                `.trim();
                
                await m.reply(successText);
            }
            else if (command === 'unmute') {
                await sock.groupSettingUpdate(m.from, 'not_announcement');
                
                const successText = `
✅ *ꜱᴜᴄᴄᴇꜱꜱ*

ɢʀᴏᴜᴘ ʜᴀꜱ ʙᴇᴇɴ ᴜɴᴍᴜᴛᴇᴅ

ᴇᴠᴇʀʏᴏɴᴇ ᴄᴀɴ ꜱᴇɴᴅ ᴍᴇꜱꜱᴀɢᴇꜱ
                `.trim();
                
                await m.reply(successText);
            }
            else if (command === 'reset') {
                await sock.groupUpdateDescription(m.from, '');
                
                const successText = `
✅ *ꜱᴜᴄᴄᴇꜱꜱ*

ɢʀᴏᴜᴘ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ ʀᴇꜱᴇᴛ

ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ ʜᴀꜱ ʙᴇᴇɴ ᴄʟᴇᴀʀᴇᴅ
                `.trim();
                
                await m.reply(successText);
            }
            else {
                await m.reply(`❌ ᴇʀʀᴏʀ 
    
ɪɴᴠᴀʟɪᴅ ᴏᴘᴛɪᴏɴ: ${command}

ᴜꜱᴇ: ɴᴀᴍᴇ, ᴅᴇꜱᴄ, ᴍᴜᴛᴇ, ᴜɴᴍᴜᴛᴇ, ᴏʀ ʀᴇꜱᴇᴛ`);
            }
            
        } catch (err) {
            console.error('Group Error:', err);
            await m.reply(`❌ ᴇʀʀᴏʀ 
    
ꜰᴀɪʟᴇᴅ ᴛᴏ ᴜᴘᴅᴀᴛᴇ ɢʀᴏᴜᴘ ꜱᴇᴛᴛɪɴɢꜱ

${err.message.substring(0, 50)}`);
        }
    }
};
