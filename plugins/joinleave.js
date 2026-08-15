const { cmd } = require('../arslan');

cmd({
    pattern: "join",
    name: 'join',
    category: 'Admin',
    description: 'Join or leave groups',
    aliases: ['leave'],
    tags: ['group'],
    command: /^\.?(join|leave)$/i,
    filename: __filename
}, async (sock, m, args) => {
        try {
            const commandName = m.commandName || (m.text?.split(' ')[0]?.replace('.', '') || '');
            
            if (commandName === 'join') {
                if (!m.isOwner) {
                    return await m.reply('ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ');
                }

                if (!args.length) {
                    return await m.reply('ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɢʀᴏᴜᴘ ɪɴᴠɪᴛᴇ ʟɪɴᴋ\n\nᴇxᴀᴍᴘʟᴇ: .join https://chat.whatsapp.com/xxxxx');
                }

                const inviteLink = args[0];
                
                let inviteCode = '';
                if (inviteLink.includes('chat.whatsapp.com/')) {
                    inviteCode = inviteLink.split('chat.whatsapp.com/')[1];
                    inviteCode = inviteCode.split('?')[0];
                    inviteCode = inviteCode.split('/')[0];
                } else {
                    inviteCode = inviteLink;
                }

                if (!inviteCode) {
                    return await m.reply('ɪɴᴠᴀʟɪᴅ ɪɴᴠɪᴛᴇ ʟɪɴᴋ ғᴏʀᴍᴀᴛ');
                }

                await m.reply('ᴛʀʏɪɴɢ ᴛᴏ ᴊᴏɪɴ ᴛʜᴇ ɢʀᴏᴜᴘ...');

                try {
                    const res = await sock.groupAcceptInvite(inviteCode);
                    await m.reply(`sᴜᴄᴄᴇssғᴜʟʟʏ ᴊᴏɪɴᴇᴅ ᴛʜᴇ ɢʀᴏᴜᴘ\n\nɢʀᴏᴜᴘ ɪᴅ: ${res || inviteCode}`);
                } catch (joinErr) {
                    if (joinErr.message?.includes('already')) {
                        await m.reply('ʙᴏᴛ ɪs ᴀʟʀᴇᴀᴅʏ ɪɴ ᴛʜᴀᴛ ɢʀᴏᴜᴘ');
                    } else if (joinErr.message?.includes('invalid')) {
                        await m.reply('ɪɴᴠᴀʟɪᴅ ᴏʀ ᴇxᴘɪʀᴇᴅ ɪɴᴠɪᴛᴇ ʟɪɴᴋ');
                    } else {
                        await m.reply(`ғᴀɪʟᴇᴅ ᴛᴏ ᴊᴏɪɴ: ${joinErr.message}`);
                    }
                }
            }
            else if (commandName === 'leave') {
                if (!m.isGroup) {
                    return await m.reply('ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ɪɴ ɢʀᴏᴜᴘs');
                }

                if (!m.isOwner && !m.isAdmin) {
                    return await m.reply('ᴏɴʟʏ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴs ᴏʀ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ');
                }

                const needConfirm = args[0]?.toLowerCase() === 'confirm';
                
                if (!needConfirm) {
                    return await m.reply(`ᴄᴏɴғɪʀᴍᴀᴛɪᴏɴ ʀᴇǫᴜɪʀᴇᴅ\n\nᴛʏᴘᴇ: .ʟᴇᴀᴠᴇ ᴄᴏɴғɪʀᴍ\n\nᴛʜɪs ᴡɪʟʟ ᴍᴀᴋᴇ ᴛʜᴇ ʙᴏᴛ ʟᴇᴀᴠᴇ ᴛʜɪs ɢʀᴏᴜᴘ`);
                }

                const groupName = m.groupMetadata?.subject || 'ᴛʜɪs ɢʀᴏᴜᴘ';
                
                await m.reply(`ʟᴇᴀᴠɪɴɢ ${groupName}...`);
                
                setTimeout(async () => {
                    try {
                        await sock.groupLeave(m.from);
                    } catch (err) {
                        console.error('Leave Error:', err);
                    }
                }, 1000);
            }
        } catch (err) {
            console.error('Error:', err);
            await m.reply(`ᴇʀʀᴏʀ: ${err.message}`);
        }
    });
