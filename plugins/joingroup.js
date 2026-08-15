const { cmd } = require('../arslan');

cmd({
    pattern: "joingroup",
    name: 'joingroup',
    aliases: ['join', 'gcjoin', 'groupinfo'],
    category: 'Admin',
    description: 'Join a group via invite link or get group info from link',
    filename: __filename
}, async (sock, m, args) => {
        if (!m.isOwner) return;

        const chatId = m.from;

        // Your dispatcher doesn't pass which alias was used, so recover it
        // from the raw message body to tell .groupinfo apart from .joingroup/.join/.gcjoin
        const commandUsed = m.body
            ?.slice(global.BOT_PREFIX.length)
            .trim()
            .split(/\s+/)[0]
            .toLowerCase() || '';
        const isInfo = commandUsed === 'groupinfo';

        const input = args[0];

        if (!input) {
            return await m.reply(
                `*${isInfo ? '🔍 GROUP INFO' : '🚪 JOIN GROUP'}*\n\n` +
                `*Usage:*\n` +
                `• \`.joingroup https://chat.whatsapp.com/XXXX\`\n` +
                `• \`.joingroup XXXX\` (code only)\n` +
                `• \`.groupinfo https://chat.whatsapp.com/XXXX\` — get info without joining`
            );
        }

        // Extract code from full link or use directly
        const code = input.replace('https://chat.whatsapp.com/', '').trim();

        try {
            if (isInfo) {
                const info = await sock.groupGetInviteInfo(code);
                const members = info.participants?.length || 0;

                return await m.reply(
                    `╔═══════════════════════╗\n` +
                    `║    🔍 *GROUP INFO*       ║\n` +
                    `╚═══════════════════════╝\n\n` +
                    `*Name:* ${info.subject || 'Unknown'}\n` +
                    `*Description:* ${info.desc || 'None'}\n` +
                    `*Members:* ${members}\n` +
                    `*Created:* ${info.creation ? new Date(info.creation * 1000).toLocaleDateString() : 'Unknown'}\n` +
                    `*JID:* \`${info.id}\``
                );
            } else {
                const response = await sock.groupAcceptInvite(code);
                return await m.reply(`✅ *Joined group successfully!*\n\nJID: \`${response}\``);
            }
        } catch (e) {
            console.error('[JOINGROUP] Error:', e.message);
            await m.reply(`❌ Failed: ${e.message}`);
        }
    });
