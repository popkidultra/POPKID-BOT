const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/antilink.json');

function loadAntilinkData() {
    try {
        if (!fs.existsSync(DATA_PATH)) return {};
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    } catch (error) {
        console.error('Error loading antilink data:', error.message);
        return {};
    }
}

function saveAntilinkData(data) {
    try {
        const dataDir = path.dirname(DATA_PATH);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving antilink data:', error.message);
    }
}

async function setAntilink(chatId, action) {
    try {
        const data = loadAntilinkData();
        data[chatId] = { enabled: true, action };
        saveAntilinkData(data);
        return true;
    } catch (error) {
        console.error('Error setting antilink:', error.message);
        return false;
    }
}

async function getAntilink(chatId) {
    try {
        const data = loadAntilinkData();
        return data[chatId] || null;
    } catch (error) {
        console.error('Error getting antilink:', error.message);
        return null;
    }
}

async function removeAntilink(chatId) {
    try {
        const data = loadAntilinkData();
        data[chatId] = { enabled: false, action: null };
        saveAntilinkData(data);
        return true;
    } catch (error) {
        console.error('Error removing antilink:', error.message);
        return false;
    }
}

const linkPatterns = {
    whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/i,
    whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/i,
    telegram: /t\.me\/[A-Za-z0-9_]+/i,
    allLinks: /https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i
};

// isExempt: whether the sender should bypass antilink (already computed by
// handler.js as m.isAdmin / m.isOwner / m.isDev — no separate lookup needed)
async function handleLinkDetection(sock, chatId, message, userMessage, senderId, isExempt) {
    try {
        const config = await getAntilink(chatId);
        if (!config?.enabled) return;
        if (isExempt) return;

        const action = config.action || 'delete';
        let shouldAct = false;
        let linkType = '';

        if (linkPatterns.whatsappGroup.test(userMessage)) {
            shouldAct = true;
            linkType = 'WhatsApp Group';
        } else if (linkPatterns.whatsappChannel.test(userMessage)) {
            shouldAct = true;
            linkType = 'WhatsApp Channel';
        } else if (linkPatterns.telegram.test(userMessage)) {
            shouldAct = true;
            linkType = 'Telegram';
        } else if (linkPatterns.allLinks.test(userMessage)) {
            shouldAct = true;
            linkType = 'Link';
        }

        if (!shouldAct) return;

        const messageId = message.key.id;
        const participant = message.key.participant || senderId;

        if (action === 'delete' || action === 'kick') {
            try {
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: messageId,
                        participant
                    }
                });
            } catch (error) {
                console.error('Failed to delete message:', error.message);
            }
        }

        if (action === 'warn' || action === 'delete') {
            await sock.sendMessage(chatId, {
                text: `⚠️ *Antilink Warning*\n\n@${senderId.split('@')[0]}, posting ${linkType} links is not allowed!`,
                mentions: [senderId]
            });
        }

        if (action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `🚫 @${senderId.split('@')[0]} has been removed for posting ${linkType} links.`,
                    mentions: [senderId]
                });
            } catch (error) {
                console.error('Failed to kick user:', error.message);
                await sock.sendMessage(chatId, {
                    text: `⚠️ Failed to remove user. Make sure the bot is an admin.`
                });
            }
        }
    } catch (error) {
        console.error('Error in link detection:', error.message);
    }
}

module.exports = {
    handleLinkDetection,
    setAntilink,
    getAntilink,
    removeAntilink
};
