const { cmd } = require('../arslan');

cmd({
    pattern: "autofeature",
    name: 'autofeature',
    category: 'Admin',
    aliases: ['af'],
    description: 'Toggle auto-read, auto-view, auto-like, and presence simulation',
    filename: __filename
}, async (sock, m, args) => {
        if (!global.owners.includes(m.sender)) {
            return;
        }

        const sub = (args[0] || '').toLowerCase();
        const val = (args[1] || '').toLowerCase();

        const onOff = (v) => v === 'on' ? true : v === 'off' ? false : null;

        switch (sub) {
            case 'read': {
                const parsed = onOff(val);
                if (parsed === null) return m.reply(`ᴀᴜᴛᴏ-ʀᴇᴀᴅ: ${global.autoRead ? 'ᴏɴ' : 'ᴏғғ'}\n\nᴜsᴇ: .autofeature read on/off`);
                global.autoRead = parsed;
                return m.reply(`ᴀᴜᴛᴏ-ʀᴇᴀᴅ ${parsed ? 'ᴏɴ' : 'ᴏғғ'}`);
            }
            case 'view': {
                const parsed = onOff(val);
                if (parsed === null) return m.reply(`ᴀᴜᴛᴏ-ᴠɪᴇᴡ (sᴛᴀᴛᴜs): ${global.autoView ? 'ᴏɴ' : 'ᴏғғ'}\n\nᴜsᴇ: .autofeature view on/off`);
                global.autoView = parsed;
                return m.reply(`ᴀᴜᴛᴏ-ᴠɪᴇᴡ ${parsed ? 'ᴏɴ' : 'ᴏғғ'}`);
            }
            case 'like': {
                const parsed = onOff(val);
                if (parsed === null) return m.reply(`ᴀᴜᴛᴏ-ʟɪᴋᴇ (sᴛᴀᴛᴜs): ${global.autoLike ? 'ᴏɴ' : 'ᴏғғ'}\n\nᴜsᴇ: .autofeature like on/off`);
                global.autoLike = parsed;
                return m.reply(`ᴀᴜᴛᴏ-ʟɪᴋᴇ ${parsed ? 'ᴏɴ' : 'ᴏғғ'}`);
            }
            case 'presence': {
                const modes = ['none', 'typing', 'recording', 'online'];
                if (!modes.includes(val)) {
                    return m.reply(`ᴘʀᴇsᴇɴᴄᴇ ᴍᴏᴅᴇ: ${global.presenceMode}\n\nᴜsᴇ: .autofeature presence none/typing/recording/online`);
                }
                global.presenceMode = val;
                return m.reply(`ᴘʀᴇsᴇɴᴄᴇ ᴍᴏᴅᴇ sᴇᴛ ᴛᴏ: ${val}`);
            }
            default:
                return m.reply(
                    `⚙️ *AUTO FEATURES*\n\n` +
                    `ᴀᴜᴛᴏ-ʀᴇᴀᴅ: ${global.autoRead ? 'ᴏɴ' : 'ᴏғғ'}\n` +
                    `ᴀᴜᴛᴏ-ᴠɪᴇᴡ: ${global.autoView ? 'ᴏɴ' : 'ᴏғғ'}\n` +
                    `ᴀᴜᴛᴏ-ʟɪᴋᴇ: ${global.autoLike ? 'ᴏɴ' : 'ᴏғғ'}\n` +
                    `ᴘʀᴇsᴇɴᴄᴇ: ${global.presenceMode}\n\n` +
                    `ᴜsᴀɢᴇ:\n` +
                    `.autofeature read on/off\n` +
                    `.autofeature view on/off\n` +
                    `.autofeature like on/off\n` +
                    `.autofeature presence none/typing/recording/online`
                );
        }
    });
