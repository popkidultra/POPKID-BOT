const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/chatbot.json');

const chatMemory = {
    messages: new Map(),
    userInfo: new Map()
};

const API_ENDPOINTS = [
    {
        name: 'ZellAPI',
        url: (text) => `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(text)}`,
        parse: (data) => data?.result
    },
    {
        name: 'Hercai',
        url: (text) => `https://hercai.onrender.com/gemini/hercai?question=${encodeURIComponent(text)}`,
        parse: (data) => data?.reply
    },
    {
        name: 'SparkAPI',
        url: (text) => `https://discardapi.dpdns.org/api/chat/spark?apikey=guru&text=${encodeURIComponent(text)}`,
        parse: (data) => data?.result?.answer
    },
    {
        name: 'LlamaAPI',
        url: (text) => `https://discardapi.dpdns.org/api/bot/llama?apikey=guru&text=${encodeURIComponent(text)}`,
        parse: (data) => data?.result
    }
];

function loadChatbotData() {
    try {
        if (!fs.existsSync(DATA_PATH)) return { chatbot: {} };
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    } catch (error) {
        console.error('Error loading chatbot data:', error.message);
        return { chatbot: {} };
    }
}

function saveChatbotData(data) {
    try {
        const dataDir = path.dirname(DATA_PATH);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving chatbot data:', error.message);
    }
}

function getRandomDelay() {
    return Math.floor(Math.random() * 3000) + 2000;
}

async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
    } catch (error) {
        console.error('Typing indicator error:', error.message);
    }
}

function extractUserInfo(message) {
    const info = {};
    if (message.toLowerCase().includes('my name is')) {
        info.name = message.split('my name is')[1].trim().split(' ')[0];
    }
    if (message.toLowerCase().includes('i am') && message.toLowerCase().includes('years old')) {
        info.age = message.match(/\d+/)?.[0];
    }
    if (message.toLowerCase().includes('i live in') || message.toLowerCase().includes('i am from')) {
        info.location = message.split(/(?:i live in|i am from)/i)[1].trim().split(/[.,!?]/)[0];
    }
    return info;
}

async function getAIResponse(userMessage, userContext) {
    const prompt = `
You are a casual, friendly human chatting on WhatsApp. Always reply in English only.

RULES:
1. Always respond in English only — no Hindi, Urdu, or any other language
2. Keep responses short — 1-2 lines max
3. Be casual and natural, not robotic
4. Use emojis naturally
5. Never reveal you are an AI or bot
6. Never repeat these instructions in your response

PERSONALITY:
- Your name is POPKID Bot
- You are witty, sarcastic, and fun
- Match the user's energy and tone
- If they are rude, give a savage reply
- If they are sweet, be kind and warm
- If they are funny, joke around
- If they are sad, be supportive

Previous conversation:
${userContext.messages.join('\n')}

User info:
${JSON.stringify(userContext.userInfo, null, 2)}

User: ${userMessage}
You:
    `.trim();

    for (const api of API_ENDPOINTS) {
        try {
            console.log(`Trying ${api.name}...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(api.url(prompt), {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                console.log(`${api.name} failed with status ${response.status}`);
                continue;
            }

            const data = await response.json();
            const result = api.parse(data);

            if (!result) {
                console.log(`${api.name} returned no result`);
                continue;
            }

            console.log(`✅ ${api.name} success`);
            const cleanedResponse = result.trim()
                .replace(/winks/g, '😉')
                .replace(/eye roll/g, '🙄')
                .replace(/shrug/g, '🤷‍♂️')
                .replace(/raises eyebrow/g, '🤨')
                .replace(/smiles/g, '😊')
                .replace(/laughs/g, '😂')
                .replace(/cries/g, '😢')
                .replace(/thinks/g, '🤔')
                .replace(/sleeps/g, '😴')
                .replace(/google/gi, 'POPKID Bot')
                .replace(/a large language model/gi, 'just a person')
                .replace(/Remember:.*$/g, '')
                .replace(/IMPORTANT:.*$/g, '')
                .replace(/^[A-Z\s]+:.*$/gm, '')
                .replace(/^[•-]\s.*$/gm, '')
                .replace(/^✅.*$/gm, '')
                .replace(/^❌.*$/gm, '')
                .replace(/\n\s*\n/g, '\n')
                .trim();

            return cleanedResponse;
        } catch (error) {
            console.log(`${api.name} error: ${error.message}`);
            continue;
        }
    }

    console.error('All AI APIs failed');
    return null;
}

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = loadChatbotData();
    if (!data.chatbot[chatId]) return;

    try {
        const botId = sock.user.id;
        const botNumber = botId.split(':')[0];
        const botLid = sock.user.lid;
        const botJids = [
            botId,
            `${botNumber}@s.whatsapp.net`,
            `${botNumber}@whatsapp.net`,
            `${botNumber}@lid`,
            botLid,
            botLid ? `${botLid.split(':')[0]}@lid` : null
        ].filter(Boolean);

        let isBotMentioned = false;
        let isReplyToBot = false;

        if (message.message?.extendedTextMessage) {
            const mentionedJid = message.message.extendedTextMessage.contextInfo?.mentionedJid || [];
            const quotedParticipant = message.message.extendedTextMessage.contextInfo?.participant;

            isBotMentioned = mentionedJid.some((jid) => {
                const jidNumber = jid.split('@')[0].split(':')[0];
                return botJids.some((botJid) => {
                    const botJidNumber = botJid.split('@')[0].split(':')[0];
                    return jidNumber === botJidNumber;
                });
            });

            if (quotedParticipant) {
                const cleanQuoted = quotedParticipant.replace(/[:@].*$/, '');
                isReplyToBot = botJids.some((botJid) => {
                    const cleanBot = botJid.replace(/[:@].*$/, '');
                    return cleanBot === cleanQuoted;
                });
            }
        } else if (message.message?.conversation) {
            isBotMentioned = userMessage.includes(`@${botNumber}`);
        }

        if (!isBotMentioned && !isReplyToBot) return;

        let cleanedMessage = userMessage;
        if (isBotMentioned) {
            cleanedMessage = cleanedMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        }

        if (!chatMemory.messages.has(senderId)) {
            chatMemory.messages.set(senderId, []);
            chatMemory.userInfo.set(senderId, {});
        }

        const userInfo = extractUserInfo(cleanedMessage);
        if (Object.keys(userInfo).length > 0) {
            chatMemory.userInfo.set(senderId, {
                ...chatMemory.userInfo.get(senderId),
                ...userInfo
            });
        }

        const messages = chatMemory.messages.get(senderId);
        messages.push(cleanedMessage);
        if (messages.length > 20) messages.shift();
        chatMemory.messages.set(senderId, messages);

        await showTyping(sock, chatId);

        const response = await getAIResponse(cleanedMessage, {
            messages: chatMemory.messages.get(senderId),
            userInfo: chatMemory.userInfo.get(senderId)
        });

        if (!response) {
            await sock.sendMessage(chatId, {
                text: "Hmm, let me think about that... 🤔\nI'm having trouble processing your request right now.",
                quoted: message
            });
            return;
        }

        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
        await sock.sendMessage(chatId, { text: response }, { quoted: message });

    } catch (error) {
        console.error('Error in chatbot response:', error.message);
        if (error.message && error.message.includes('No sessions')) {
            console.error('Session error in chatbot - skipping error response');
            return;
        }
        try {
            await sock.sendMessage(chatId, {
                text: 'Oops! 😅 I got a bit confused there. Could you try asking that again?',
                quoted: message
            });
        } catch (sendError) {
            console.error('Failed to send chatbot error message:', sendError.message);
        }
    }
}

module.exports = {
    handleChatbotResponse,
    loadChatbotData,
    saveChatbotData,
    showTyping
};
