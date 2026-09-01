const fs = require('fs');
const os = require('os');
const { cmd } = require('../arslan');

/**
 * detectHost()
 * Figures out which platform the bot is running on by checking environment
 * variables each provider sets automatically (no config needed). Falls back
 * to generic "Panel" detection for any Pterodactyl-style panel (Katabump,
 * most VPS control panels, etc.), then finally to "Unknown/VPS".
 */
function detectHost() {
    const env = process.env;
    const hostname = os.hostname() || '';

    // ── Heroku ──────────────────────────────────────────────────────────
    if (env.DYNO || env.HEROKU_APP_NAME || env.HEROKU_SLUG_COMMIT) {
        return {
            platform: 'heroku',
            label: 'Heroku',
            details: {
                app: env.HEROKU_APP_NAME || null,
                dyno: env.DYNO || null,
                slug: env.HEROKU_SLUG_COMMIT || null
            }
        };
    }

    // ── Railway ─────────────────────────────────────────────────────────
    if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID) {
        return {
            platform: 'railway',
            label: 'Railway',
            details: {
                project: env.RAILWAY_PROJECT_NAME || env.RAILWAY_PROJECT_ID || null,
                service: env.RAILWAY_SERVICE_NAME || env.RAILWAY_SERVICE_ID || null,
                environment: env.RAILWAY_ENVIRONMENT || null,
                url: env.RAILWAY_STATIC_URL || env.RAILWAY_PUBLIC_DOMAIN || null
            }
        };
    }

    // ── Koyeb ───────────────────────────────────────────────────────────
    if (env.KOYEB_APP_NAME || env.KOYEB_SERVICE_NAME || env.KOYEB_PUBLIC_DOMAIN) {
        return {
            platform: 'koyeb',
            label: 'Koyeb',
            details: {
                app: env.KOYEB_APP_NAME || null,
                service: env.KOYEB_SERVICE_NAME || null,
                domain: env.KOYEB_PUBLIC_DOMAIN || null
            }
        };
    }

    // ── Render ──────────────────────────────────────────────────────────
    if (env.RENDER || env.RENDER_SERVICE_ID) {
        return {
            platform: 'render',
            label: 'Render',
            details: {
                service: env.RENDER_SERVICE_NAME || env.RENDER_SERVICE_ID || null,
                url: env.RENDER_EXTERNAL_URL || null
            }
        };
    }

    // ── Replit ──────────────────────────────────────────────────────────
    if (env.REPL_ID || env.REPL_SLUG) {
        return {
            platform: 'replit',
            label: 'Replit',
            details: {
                repl: env.REPL_SLUG || null,
                owner: env.REPL_OWNER || null
            }
        };
    }

    // ── Katabump (built on a Pterodactyl-style panel) ──────────────────
    // Katabump doesn't currently expose a uniquely-named env var, so it's
    // caught here via hostname hints before the generic panel check.
    if (/katabump/i.test(hostname) || /katabump/i.test(env.HOSTNAME || '')) {
        return {
            platform: 'katabump',
            label: 'Katabump',
            details: { hostname }
        };
    }

    // ── Generic panel (Pterodactyl and Pterodactyl-based panels) ───────
    // Pterodactyl (and most panels built on it — this covers the vast
    // majority of "control panel" bot hosts) injects these automatically.
    const pterodactylKeys = ['P_SERVER_UID', 'P_SERVER_LOCATION', 'SERVER_MEMORY', 'SERVER_IP', 'STARTUP'];
    if (pterodactylKeys.some(k => env[k] !== undefined)) {
        return {
            platform: 'panel',
            label: 'Panel (Pterodactyl-based)',
            details: {
                serverUid: env.P_SERVER_UID || null,
                location: env.P_SERVER_LOCATION || null,
                memory: env.SERVER_MEMORY || null,
                ip: env.SERVER_IP || null
            }
        };
    }

    // ── Docker (generic container, no known panel/PaaS markers) ────────
    if (fs.existsSync('/.dockerenv')) {
        return {
            platform: 'docker',
            label: 'Docker container',
            details: { hostname }
        };
    }

    // ── Fallback ─────────────────────────────────────────────────────
    return {
        platform: 'unknown',
        label: 'Unknown host / VPS',
        details: { hostname, platform: os.platform(), arch: os.arch() }
    };
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
}

cmd({
    pattern: "host",
    name: 'host',
    category: 'Owner',
    aliases: ['platform', 'whereami'],
    description: 'Owner only — shows which platform/host the bot is running on',
    filename: __filename
}, async (sock, m, args) => {
        if (!m.isOwner && !m.isDev) {
            return m.reply('❌ This command is restricted to the bot owner.');
        }

        const host = detectHost();

        let text = `🖥️ *HOST INFO*\n\n📡 *Platform:* ${host.label}\n`;

        const detailEntries = Object.entries(host.details || {}).filter(([, v]) => v !== null && v !== undefined);
        if (detailEntries.length) {
            text += `\n*Details:*\n`;
            for (const [key, value] of detailEntries) {
                text += `• ${key}: ${value}\n`;
            }
        }

        text += `\n*System:*\n`;
        text += `• OS: ${os.type()} (${os.platform()}/${os.arch()})\n`;
        text += `• Node: ${process.version}\n`;
        text += `• Uptime: ${formatUptime(process.uptime())}\n`;

        return m.reply(text);
    });
