const { setAntilink, getAntilink, removeAntilink } = require('../lib/antilink');

module.exports = {
    name: 'antilink',
    aliases: ['alink', 'linkblock'],
    category: 'Admin',
    description: 'Prevent users from sending links in the group',

    async execute(sock, m, args) {
        const chatId = m.from;

        if (!m.isGroup) {
            return m.reply('❌ This command can only be used in groups.');
        }
        if (!m.isAdmin && !m.isOwner) {
            return m.reply('❌ Only group admins can use this command.');
        }

        const action = (args[0] || '').toLowerCase();

        if (!action) {
            const config = await getAntilink(chatId);
            return m.reply(
                `*🔗 ANTILINK SETUP*\n\n` +
                `*Current Status:* ${config?.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                `*Current Action:* ${config?.action || 'Not set'}\n\n` +
                `*Commands:*\n` +
                `• \`.antilink on\` - Enable antilink\n` +
                `• \`.antilink off\` - Disable antilink\n` +
                `• \`.antilink set delete\` - Delete link messages\n` +
                `• \`.antilink set kick\` - Kick users who send links\n` +
                `• \`.antilink set warn\` - Warn users only\n\n` +
                `*Protected Links:*\n` +
                `• WhatsApp Groups\n` +
                `• WhatsApp Channels\n` +
                `• Telegram\n` +
                `• All other links\n\n` +
                `*Note:* Admins and Owner are exempt.`
            );
        }

        switch (action) {
            case 'on': {
                const existingConfig = await getAntilink(chatId);
                if (existingConfig?.enabled) {
                    return m.reply('⚠️ *Antilink is already enabled*');
                }
                const result = await setAntilink(chatId, 'delete');
                return m.reply(
                    result
                        ? '✅ *Antilink enabled successfully!*\n\nDefault action: Delete messages\n\n*Exempt:* Admins, Owner'
                        : '❌ *Failed to enable antilink*'
                );
            }

            case 'off': {
                await removeAntilink(chatId);
                return m.reply('❌ *Antilink disabled*\n\nUsers can now send links freely.');
            }

            case 'set': {
                if (args.length < 2) {
                    return m.reply('❌ *Please specify an action*\n\nUsage: `.antilink set delete | kick | warn`');
                }
                const setAction = args[1].toLowerCase();
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    return m.reply('❌ *Invalid action*\n\nChoose: delete, kick, or warn');
                }
                const setResult = await setAntilink(chatId, setAction);
                const actionDescriptions = {
                    delete: 'Delete link messages and warn users',
                    kick: 'Delete messages and remove users',
                    warn: 'Only send warning messages'
                };
                return m.reply(
                    setResult
                        ? `✅ *Antilink action set to: ${setAction}*\n\n${actionDescriptions[setAction]}\n\n*Exempt:* Admins, Owner`
                        : '❌ *Failed to set antilink action*'
                );
            }

            case 'status':
            case 'get': {
                const status = await getAntilink(chatId);
                let behaviorNote = '';
                if (status?.action === 'delete') behaviorNote = '• Message is deleted\n• User gets warning';
                else if (status?.action === 'kick') behaviorNote = '• Message is deleted\n• User is removed from group';
                else if (status?.action === 'warn') behaviorNote = '• User gets warning\n• Message stays';

                return m.reply(
                    `*🔗 ANTILINK STATUS*\n\n` +
                    `*Status:* ${status?.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                    `*Action:* ${status?.action || 'Not set'}\n\n` +
                    `*What happens when links are detected:*\n${behaviorNote}\n\n` +
                    `*Exempt:* Admins, Owner`
                );
            }

            default:
                return m.reply('❌ *Invalid command*\n\nUse `.antilink` to see available options.');
        }
    }
};
