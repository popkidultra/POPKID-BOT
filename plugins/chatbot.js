const { loadChatbotData, saveChatbotData, showTyping } = require('../lib/chatbot');

const { cmd } = require('../arslan');

cmd({
    pattern: "chatbot",
    name: 'chatbot',
    aliases: ['bot', 'ai', 'achat'],
    category: 'Admin',
    description: 'Enable or disable AI chatbot for the group',
    filename: __filename
}, async (sock, m, args) => {
        const chatId = m.from;

        if (!m.isGroup) {
            return m.reply('❌ This command can only be used in groups.');
        }
        if (!m.isAdmin && !m.isOwner) {
            return m.reply('❌ Only group admins can use this command.');
        }

        const match = args.join(' ').toLowerCase();

        if (!match) {
            await showTyping(sock, chatId);
            return m.reply(
                `*🤖 CHATBOT SETUP*\n\n` +
                `*Storage:* File System\n` +
                `*APIs:* 4 endpoints with fallback\n\n` +
                `*Commands:*\n` +
                `• \`.chatbot on\` - Enable chatbot\n` +
                `• \`.chatbot off\` - Disable chatbot\n\n` +
                `*How it works:*\n` +
                `When enabled, bot responds when mentioned or replied to.\n\n` +
                `*Features:*\n` +
                `• Natural English conversations\n` +
                `• Remembers context\n` +
                `• Personality-based replies\n` +
                `• Auto fallback if API fails`
            );
        }

        const data = loadChatbotData();

        if (match === 'on') {
            await showTyping(sock, chatId);
            if (data.chatbot[chatId]) {
                return m.reply('⚠️ *Chatbot is already enabled for this group*');
            }
            data.chatbot[chatId] = true;
            saveChatbotData(data);
            return m.reply('✅ *Chatbot enabled!*\n\nMention me or reply to my messages to chat.');
        }

        if (match === 'off') {
            await showTyping(sock, chatId);
            if (!data.chatbot[chatId]) {
                return m.reply('⚠️ *Chatbot is already disabled for this group*');
            }
            delete data.chatbot[chatId];
            saveChatbotData(data);
            return m.reply('❌ *Chatbot disabled!*\n\nI will no longer respond to mentions.');
        }

        await showTyping(sock, chatId);
        return m.reply('❌ *Invalid command*\n\nUse: `.chatbot on/off`');
    });
