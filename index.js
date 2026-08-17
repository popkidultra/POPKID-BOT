require('./config')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, generateWAMessageContent, generateWAMessageFromContent, generateMessageID, prepareWAMessageMedia, fetchLatestWaWebVersion, proto,generateProfilePicture, getContentType } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const http = require('http');
const QRCode = require('qrcode');
const { Boom } = require('@hapi/boom');
const { sendButtons, sendInteractiveMessage } = require('gifted-btns');
const serializeMessage = require('./handler.js');
const { decodeSessionId } = require('./lib/sessionLoader');
const { AntideleteHandler } = require('./lib/antidelete');
const { handleChatbotResponse } = require('./lib/chatbot');
const { handleLinkDetection } = require('./lib/antilink');
const JimpImport = require('jimp');

const Jimp =
  JimpImport.read
    ? JimpImport
    : JimpImport.Jimp
    ? JimpImport.Jimp
    : JimpImport.default;

global.generateWAMessageContent = generateWAMessageContent;
global.generateWAMessageFromContent = generateWAMessageFromContent;
global.generateMessageID = generateMessageID;
global.prepareWAMessageMedia = prepareWAMessageMedia;
global.proto = proto;
global.Jimp = Jimp;
global.generateProfilePicture = generateProfilePicture;
global.downloadMediaMessage = downloadMediaMessage;
global.bannedChats = global.bannedChats || [];
if (!fs.existsSync(__dirname + '/session/creds.json') && global.sessionid) {
    const result = decodeSessionId(global.sessionid);
    if (result.ok) {
        try {
            fs.mkdirSync(__dirname + '/session', { recursive: true });
            fs.writeFileSync(__dirname + '/session/creds.json', result.data);
            console.log('✅ Session restored from SESSION_ID');
        } catch (err) {
            console.error('Error writing restored session:', err.message);
        }
    } else {
        console.error('❌ Failed to restore session from SESSION_ID:', result.reason);
        console.warn('⚠️ Make sure you copied the FULL session string (e.g. POPKID~...).');
    }
}

const AUTH_FOLDER = './session';
const PLUGIN_FOLDER = './plugins';
const PORT = process.env.PORT || 3000;

let latestQR = '';
let botStatus = 'disconnected';
let pairingCodes = new Map();
let presenceInterval = null;
let sock = null;
let isConnecting = false;
let lastStatusReactTime = 0;

// --- Status-reaction LID resolution -----------------------------------
// WhatsApp sometimes reports a status poster as an @lid (linked-device id)
// instead of their real @s.whatsapp.net JID. Reacting to a status with the
// wrong JID in `key.participant` fails silently, which is why "auto like
// status" can look broken even though the code runs without errors.
// This cache + resolver mirrors the approach used by Toxic-MD: cache any
// LID→phone mapping we learn, and try several real resolution paths
// (Baileys' own lid-mapping store first) before falling back to whatever
// Baileys handed us.
const lidPhoneCache = new Map();

function cacheLidPhone(lidNum, phoneNum) {
    if (!lidNum || !phoneNum || lidNum === phoneNum) return;
    lidPhoneCache.set(lidNum, phoneNum);
}

async function resolveStatusParticipant(sock, rawMsg) {
    const rawParticipant = rawMsg.key.participant;
    if (!rawParticipant || !rawParticipant.endsWith('@lid')) {
        return rawParticipant;
    }

    const lidNum = rawParticipant.split('@')[0].split(':')[0];

    // 1) Already resolved this LID before in this session.
    const cached = lidPhoneCache.get(lidNum);
    if (cached) {
        return `${cached}@s.whatsapp.net`;
    }

    // 2) Baileys sometimes attaches the real number directly on the event.
    const rawPn = rawMsg.key?.participantPn || rawMsg.key?.senderPn || rawMsg.participantPn;
    if (rawPn) {
        const resolved = rawPn.includes('@') ? rawPn : `${rawPn}@s.whatsapp.net`;
        const phoneNum = resolved.split('@')[0].split(':')[0];
        cacheLidPhone(lidNum, phoneNum);
        return resolved;
    }

    // 3) Ask Baileys' own LID↔PN mapping store, trying a couple of formats
    //    since the stored key isn't always exactly what we received.
    if (sock.signalRepository?.lidMapping?.getPNForLID) {
        const variants = [rawParticipant, `${lidNum}:0@lid`, `${lidNum}@lid`];
        for (const variant of variants) {
            try {
                const pn = await sock.signalRepository.lidMapping.getPNForLID(variant);
                if (pn && typeof pn === 'string') {
                    const phoneNum = pn.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                    if (phoneNum.length >= 7 && phoneNum !== lidNum) {
                        cacheLidPhone(lidNum, phoneNum);
                        return `${phoneNum}@s.whatsapp.net`;
                    }
                }
            } catch (err) {
                // try the next variant
            }
        }
    }

    // 4) Legacy fallback some Baileys builds exposed.
    if (typeof sock.getJidFromLid === 'function') {
        const resolved = await sock.getJidFromLid(rawParticipant).catch(() => null);
        if (resolved) {
            const phoneNum = resolved.split('@')[0].split(':')[0];
            cacheLidPhone(lidNum, phoneNum);
            return resolved;
        }
    }

    // Nothing worked — return the raw @lid, same as before, so the caller
    // keeps its existing "best effort" behavior instead of crashing.
    return rawParticipant;
}
// -----------------------------------------------------------------------

function loadPrefix() {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.prefix) {
                global.BOT_PREFIX = config.prefix;
                console.log(`✅ Loaded prefix: ${global.BOT_PREFIX}`);
            }
        } catch (err) {
            console.error('Error loading config:', err);
        }
    }
    startBot();
}

function startBot() {
    console.log('🚀 Starting WhatsApp Bot...');
    isConnecting = true;

    if (!fs.existsSync(AUTH_FOLDER)) {
        fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    }

    const credsPath = path.join(AUTH_FOLDER, 'creds.json');
    if (fs.existsSync(credsPath)) {
        try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            if (creds.noiseKey && creds.noiseKey.private) {

                console.log('📁 Using existing session...');
            } else {
                console.log('⚠️ Invalid session detected, will create new one...');
            }
        } catch (err) {
            console.log('⚠️ Corrupted session, will create new one...');
        }
    }

    (async () => {
        try {
            const { version, isLatest } = await fetchLatestWaWebVersion();
            console.log(`📱 Using WA v${version.join(".")}, isLatest: ${isLatest}`);

            const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

            sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                auth: state,
                printQRInTerminal: true,
                keepAliveIntervalMs: 10000,
                markOnlineOnConnect: true,
                syncFullHistory: false,
                browser: ['Bot', 'Chrome', '1.0.0']
            });

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    QRCode.toDataURL(qr, (err, url) => {
                        if (!err) {
                            latestQR = url;
                        }
                    });
                }

                if (connection === 'close') {
                    botStatus = 'disconnected';
                    isConnecting = false;

                    if (presenceInterval) {
                        clearInterval(presenceInterval);
                        presenceInterval = null;
                    }

                    const statusCode = (lastDisconnect?.error instanceof Boom)
                        ? lastDisconnect.error.output.statusCode
                        : 0;

                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    if (shouldReconnect) {
                        setTimeout(() => startBot(), 5000);
                    } else {
                        if (fs.existsSync(AUTH_FOLDER)) {
                            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                        }
                        setTimeout(() => startBot(), 3000);
                    }
                }

                else if (connection === 'open') {
                    botStatus = 'connected';
                    isConnecting = false;

                    if (!global.owners) global.owners = [];
                    if (!global.owners.includes(sock.user.id)) {
                        global.owners.push(sock.user.id);
                    }

                    presenceInterval = setInterval(() => {
                        if (sock?.ws?.readyState === 1) {
                            sock.sendPresenceUpdate('available');
                        }
                    }, 10000);

                    // Small delay so the socket is fully ready before sending
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // Clean self-JID (strip :device suffix) so the DM actually lands
                    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

                    try {
                        await sock.newsletterFollow('120363426778975572@newsletter');
                        console.log('📡 Auto-followed Official Newsletter');
                    } catch (err) {
                        console.log('Newsletter follow verified.');
                    }

                    try {
                        await sock.sendMessage(botNumber, {
                            text: `🤖 Bot Connected Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online and Ready!\n📝 Prefix: ${global.BOT_PREFIX}\n👑 Owners: ${global.owners.length}\n\n✅ Make sure to join below channel`,
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: '120363426778975572@newsletter',
                                    newsletterName: 'Popkid',
                                    serverMessageId: -1
                                }
                            }
                        });
                    } catch (err) {
                        console.log('❌ Connection message error:', err.message);
                    }
                }

                else if (connection === 'connecting') {
                    botStatus = 'connecting';
                    isConnecting = true;
                }
            });

            sock.ev.on('creds.update', async () => {
                await saveCreds();
                console.log('💾 Credentials updated');
            });

            // global.plugins is shared with arslan.js's cmd() registry, so a
            // command-style plugin (const { cmd } = require('../arslan')) and a
            // legacy { name, execute } plugin land in the exact same Map.
            global.plugins = global.plugins instanceof Map ? global.plugins : new Map();
            const plugins = global.plugins;
            const pluginPath = path.join(__dirname, PLUGIN_FOLDER);

            if (fs.existsSync(pluginPath)) {
                try {
                    const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js'));

                    for (const file of pluginFiles) {
                        try {
                            const beforeCount = plugins.size;
                            const plugin = require(path.join(pluginPath, file));

                            if (plugins.size > beforeCount) {
                                // Self-registered one or more commands via cmd() in ./arslan.js
                                console.log(`✅ Loaded command plugin: ${file}`);
                            } else if (plugin && plugin.name && typeof plugin.execute === 'function') {
                                plugins.set(plugin.name.toLowerCase(), plugin);
                                if (Array.isArray(plugin.aliases)) {
                                    plugin.aliases.forEach(alias => {
                                        plugins.set(alias.toLowerCase(), plugin);
                                    });
                                }
                                console.log(`✅ Loaded plugin: ${plugin.name}`);
                            } else {
                                console.warn(`⚠️ Invalid plugin structure in ${file}`);
                            }
                        } catch (error) {
                            console.error(`❌ Failed to load plugin ${file}:`, error.message);
                        }
                    }
                    console.log(`📦 Total plugins loaded: ${plugins.size}`);
                    global.plugins = plugins;
                } catch (error) {
                    console.error('❌ Error loading plugins:', error);
                }
            } else {
                console.log('📁 No plugins folder found');
            }

            sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type !== 'notify' && type !== 'append') return;

                const CHANNEL_ID = "120363426778975572@newsletter";

                for (const rawMsg of messages) {
                    if (rawMsg.key?.remoteJid === CHANNEL_ID && rawMsg.key?.server_id) {
                        const emojis = ["❤️", "💛", "👍", "💜", "😮", "🤍", "💙", "🔥", "💯", "⚡"];
                        const emoji = emojis[Math.floor(Math.random() * emojis.length)];

                        try {
                            await sock.newsletterReactMessage(
                                CHANNEL_ID,
                                rawMsg.key.server_id.toString(),
                                emoji
                            );
                            console.log(`✅ Channel reaction: ${emoji} to message ${rawMsg.key.server_id}`);
                        } catch (err) {
                            console.log("❌ Channel React Error:", err.message);
                        }
                        continue;
                    }
                }

                for (const rawMsg of messages) {
                    if (rawMsg.key.remoteJid === 'status@broadcast' && rawMsg.key.participant) {
                        if (global.autoView) {
                            try {
                                console.log(`📱 Status detected from: ${rawMsg.key.participant}`);
                                await sock.readMessages([rawMsg.key]);
                            } catch (err) {
                                console.log('❌ Status viewer error:', err.message);
                            }
                        }

                        if (global.autoLike) {
                            try {
                                const now = Date.now();
                                if (now - lastStatusReactTime < (global.statusReactThrottleMs ?? 5000)) {
                                    // Throttle: skip if we reacted too recently
                                } else {
                                    // Resolve the poster's real JID — WhatsApp sometimes reports
                                    // this as an @lid (linked-device id) instead of @s.whatsapp.net,
                                    // and status reactions silently fail if sent to an @lid.
                                    const realJid = await resolveStatusParticipant(sock, rawMsg);

                                    const resolvedKey = {
                                        remoteJid: 'status@broadcast',
                                        id: rawMsg.key.id,
                                        participant: realJid
                                    };

                                    const contentType = getContentType(rawMsg.message);
                                    const reactable = ['imageMessage', 'videoMessage', 'extendedTextMessage', 'conversation', 'audioMessage'];

                                    if (reactable.includes(contentType)) {
                                        const emojis = ["❤️", "🩶", "🔥", "🤍", "♦️", "🎉", "💚", "💯", "✨", "😍", "🎊"];
                                        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                                        const botId = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : sock.user?.id;

                                        await sock.sendMessage('status@broadcast',
                                            { react: { text: emoji, key: resolvedKey } },
                                            { statusJidList: [realJid, botId].filter(Boolean) }
                                        );

                                        lastStatusReactTime = Date.now();
                                        await new Promise(resolve => setTimeout(resolve, global.statusReactDelayMs ?? 2000));
                                    }
                                }
                            } catch (err) {
                                console.log('❌ Status like error:', err.message);
                            }
                        }

                        continue;
                    }
                }

                for (const rm of messages) {
                    AntideleteHandler(sock, rm).catch(err => console.error('Antidelete hook error:', err.message));
                }

                const rawMsg = messages[0];
                if (!rawMsg.message) return;

                const m = await serializeMessage(sock, rawMsg);

                if (global.autoRead) {
                    try { await sock.readMessages([rawMsg.key]); } catch (err) {}
                }

                if (global.presenceMode && global.presenceMode !== 'none' && m.from) {
                    try {
                        if (global.presenceMode === 'typing') await sock.sendPresenceUpdate('composing', m.from);
                        else if (global.presenceMode === 'recording') await sock.sendPresenceUpdate('recording', m.from);
                        else if (global.presenceMode === 'online') await sock.sendPresenceUpdate('available', m.from);
                    } catch (err) {}
                }

                if (m.isGroup && !rawMsg.key.fromMe) {
                    handleChatbotResponse(sock, m.from, rawMsg, m.body || '', m.sender)
                        .catch(err => console.error('Chatbot hook error:', err.message));

                    const isExempt = m.isAdmin || m.isOwner || m.isDev;
                    handleLinkDetection(sock, m.from, rawMsg, m.body || '', m.sender, isExempt)
                        .catch(err => console.error('Antilink hook error:', err.message));
                }

                for (const plugin of plugins.values()) {
                    if (typeof plugin.onMessage === 'function') {
                        try {
                            const blocked = await plugin.onMessage(sock, m);
                            if (blocked === true) return;
                        } catch (err) {
                            console.error(`❌ onMessage error (${plugin.name}):`, err);
                        }
                    }
                }

                if (m.body && m.body.startsWith(global.BOT_PREFIX)) {
                    const args = m.body.slice(global.BOT_PREFIX.length).trim().split(/\s+/);
                    const commandName = args.shift().toLowerCase();
                    const plugin = plugins.get(commandName);

                    if (plugin) {
                        try {
                            await plugin.execute(sock, m, args);
                        } catch (err) {
                            console.error(`❌ Plugin error (${commandName}):`, err);
                            await m.reply('❌ Error running command.');
                        }
                    }
                }
            });

            sock.ev.on('group-participants.update', async (update) => {
                try {
                    if (!global.welcomeConfig?.enabled) return

                    const groupId = update.id

                    for (const participant of update.participants) {

                        const userId = typeof participant === 'string'
                            ? participant
                            : participant.phoneNumber || participant.id

                        if (!userId) continue

                        const memberName = userId.split('@')[0]

                        if (update.action === 'add') {

                            if (userId === sock.user.id) continue

                            const text = `👋 Welcome @${memberName}!\n🎉 Glad to have you in this group!`

                            await sock.sendMessage(groupId, {
                                text,
                                mentions: [userId]
                            })

                        } else if (update.action === 'remove') {

                            const text = `ya @${memberName} has left the group.\nWe are not gonna miss you!`

                            await sock.sendMessage(groupId, {
                                text,
                                mentions: [userId]
                            })

                        }
                    }

                } catch (err) {
                    console.error('❌ group-participants.update error:', err)
                }
            })

            sock.ev.on('messages.reaction', async (reactions) => {
                console.log('💖 Reaction update:', reactions);
            });

        } catch (error) {
            console.error('❌ Bot startup error:', error);
            isConnecting = false;
            setTimeout(() => startBot(), 5000);
        }
    })();
}

function collectRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1e6) {
                req.destroy();
                reject(new Error('Request body too large'));
            }
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    const urlPath = req.url;

    if (urlPath === '/' || urlPath === '/qr') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<img src="${latestQR}" />`);
    } else if (urlPath === '/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: botStatus, connecting: isConnecting }));
    } else if (urlPath === '/pair' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('Pairing endpoint');
    } else if (urlPath === '/pair' && req.method === 'POST') {
        try {
            const body = await collectRequestBody(req);
            const params = new URLSearchParams(body);
            const number = (params.get('number') || '').replace(/[^0-9]/g, '');
            if (!number) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end('Number required');
            }
            if (!sock) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end('Bot not ready');
            }
            const code = await sock.requestPairingCode(number);
            pairingCodes.set(number, code);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('Pairing code: ' + code + '');
        } catch (err) {
            console.error('Pairing error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end('Error: ' + err.message);
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`🌐 Server listening on port ${PORT}`);
});
global.server = server;
global.PORT = PORT;
loadPrefix();
process.on('uncaughtException', err => {
    console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', err => {
    console.error('Unhandled rejection:', err);
});
