require('./config')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, generateWAMessageContent, generateWAMessageFromContent, generateMessageID, prepareWAMessageMedia, fetchLatestWaWebVersion, proto,generateProfilePicture } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const http = require('http');
const QRCode = require('qrcode');
const { Boom } = require('@hapi/boom');
const { sendButtons, sendInteractiveMessage } = require('gifted-btns');
const serializeMessage = require('./handler.js');
const { decodeSessionId } = require('./lib/sessionLoader');
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

            const plugins = new Map();
            const pluginPath = path.join(__dirname, PLUGIN_FOLDER);

            if (fs.existsSync(pluginPath)) {
                try {
                    const pluginFiles = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js'));

                    for (const file of pluginFiles) {
                        try {
                            const plugin = require(path.join(pluginPath, file));
                            if (plugin.name && typeof plugin.execute === 'function') {
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
                                const emojis = ["❤️", "🩶", "🔥", "🤍", "♦️", "🎉", "💚", "💯", "✨", "😍", "🎊"];
                                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                                const botId = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : sock.user?.id;
                                await sock.sendMessage('status@broadcast',
                                    { react: { text: emoji, key: rawMsg.key } },
                                    { statusJidList: [rawMsg.key.participant, botId].filter(Boolean) }
                                );
                            } catch (err) {
                                console.log('❌ Status like error:', err.message);
                            }
                        }

                        continue;
                    }
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
            setTimeout(() => startBot(), 10000);
        }
    })();
}

const server = http.createServer((req, res) => {
    const url = req.url;

    if (url === '/' || url === '/qr') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>WhatsApp Bot</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;">
<h1>WhatsApp Bot Status</h1>
<div id="status">Loading...</div>
<script>
async function poll(){
  const r = await fetch('/api/status');
  const d = await r.json();
  document.getElementById('status').innerText = 'Status: ' + d.status;
}
setInterval(poll, 2000);
poll();
</script>
</body></html>`);
    }

    else if (url === '/pair' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial; padding: 20px; text-align: center; }
        form { margin: 20px; padding: 20px; background: #f0f0f0; display: inline-block; }
        input, button { padding: 10px; margin: 5px; }
    </style>
</head>
<body>
    <h1>🔗 Pair WhatsApp</h1>
    <form method="POST">
        Phone: <input type="text" name="phone" placeholder="911234567890" required><br><br>
        <button type="submit">Get Code</button><br><br>
        <a href="/">← Back</a>
    </form>
</body>
</html>`);
    }

    else if (url === '/pair' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const params = new URLSearchParams(body);
                let phoneNumber = params.get('phone').trim();

                if (!phoneNumber) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`<center><h2>❌ Error: Phone number required</h2><a href="/pair">Try Again</a></center>`);
                    return;
                }

                phoneNumber = phoneNumber.replace(/\D/g, '');

                if (botStatus !== 'connecting' || !sock) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`<center><h2>⚠️ Bot not ready</h2><p>Status: ${botStatus}</p><p>Please wait for QR code to appear first</p><a href="/">← Go Back</a></center>`);
                    return;
                }

                const pairingCode = await sock.requestPairingCode(phoneNumber);

                pairingCodes.set(phoneNumber, {
                    code: pairingCode,
                    timestamp: Date.now()
                });

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial; padding: 20px; text-align: center; }
        .code { font-size: 2em; color: green; font-weight: bold; margin: 20px; }
        .info { background: #e8f5e8; padding: 15px; margin: 20px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>✅ Pairing Code Generated</h1>
    <h2>Phone: ${phoneNumber}</h2>
    <div class="code">Code: ${pairingCode}</div>
    <div class="info">
        <p>📱 Go to WhatsApp > Settings > Linked Devices > Link a Device</p>
        <p>🔢 Select "Use pairing code" and enter the code above</p>
    </div>
    <br>
    <a href="/">🏠 Home</a> | <a href="/pair">🔄 Pair Another</a>
</body>
</html>`);

                console.log(`✅ Pairing code for ${phoneNumber}: ${pairingCode}`);

            } catch (error) {
                console.error('❌ Pair error:', error);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`<center><h2>❌ Error</h2><p>${error.message}</p><p>Make sure the phone number is in international format (e.g., 911234567890)</p><a href="/pair">↩️ Try Again</a></center>`);
            }
        });
        return;
    }

    else if (url === '/api/status') {
        let pairingCode = null;
        for (const [_, data] of pairingCodes) {
            if (Date.now() - data.timestamp < 300000) {
                pairingCode = data.code;
                break;
            }
        }

        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            status: botStatus,
            hasQR: !!latestQR,
            qr: latestQR,
            pairingCode: pairingCode,
            prefix: global.BOT_PREFIX,
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        }));
    }

    else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`<center><h1>404 - Page Not Found</h1><a href="/">🏠 Go Home</a></center>`);
    }
});

server.listen(PORT, () => {
    console.log(`🌐 Web server running at http://localhost:${PORT}`);
    console.log(`📁 Session folder: ${path.resolve(AUTH_FOLDER)}`);
    loadPrefix();
});

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    if (presenceInterval) clearInterval(presenceInterval);
    if (sock) sock.end();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('⚠️ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection:', reason);
});
