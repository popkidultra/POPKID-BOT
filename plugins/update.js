const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ── GitHub configuration ──────────────────────────────────────────────────
const repoOwner = 'popkidultra';
const repoName = 'POPKID-BOT';
const branch = 'main';

// ── Paths ────────────────────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, '..'); // plugins/ -> project root
const COMMIT_FILE = path.join(PROJECT_ROOT, '.last_update_commit');

// Anything matching these (exact match, or as a directory prefix) is NEVER
// touched by the update: never overwritten, never deleted, never entered.
// Extend this list if your real project has other credential/data folders.
const PROTECTED_PATHS = [
    'config.js',
    '.env',
    'session',
    'sessions',
    'auth_info',
    'database',
    'db',
    'data',
    'node_modules',
    'package-lock.json',
    '.last_update_commit',
    '.git',
    'tmp',
    'temp',
    'logs',
    'media'
];

function isProtected(relPath) {
    const normalized = relPath.split(path.sep).join('/');
    return PROTECTED_PATHS.some(p => normalized === p || normalized.startsWith(p + '/'));
}

// ── GitHub API helpers ──────────────────────────────────────────────────
async function getLatestCommit() {
    const res = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/commits/${branch}`,
        { headers: { 'User-Agent': 'POPKID-BOT-Updater' } }
    );
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json();
    return {
        sha: data.sha,
        message: (data.commit?.message || '').split('\n')[0], // first line only
        date: data.commit?.committer?.date || data.commit?.author?.date || null
    };
}

function getLocalCommit() {
    try {
        return fs.readFileSync(COMMIT_FILE, 'utf8').trim() || null;
    } catch {
        return null;
    }
}

function saveLocalCommit(sha) {
    fs.writeFileSync(COMMIT_FILE, sha, 'utf8');
}

// ── Download + extract ──────────────────────────────────────────────────
async function downloadZip(destZipPath) {
    const zipUrl = `https://github.com/${repoOwner}/${repoName}/archive/refs/heads/${branch}.zip`;
    const res = await fetch(zipUrl, { headers: { 'User-Agent': 'POPKID-BOT-Updater' } });
    if (!res.ok) throw new Error(`Failed to download update ZIP: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destZipPath, buffer);
}

function extractZip(zipPath, destDir) {
    let AdmZip;
    try {
        AdmZip = require('adm-zip');
    } catch (err) {
        throw new Error('Missing dependency "adm-zip". Run: npm install adm-zip');
    }
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(destDir, true);

    // GitHub zips extract into a single top-level folder, e.g. "POPKID-BOT-main/"
    const entries = fs.readdirSync(destDir, { withFileTypes: true }).filter(e => e.isDirectory());
    if (entries.length !== 1) {
        throw new Error('Unexpected ZIP structure after extraction.');
    }
    return path.join(destDir, entries[0].name);
}

// ── Validation (BEFORE touching the real project) ─────────────────────────
function validateExtractedSource(srcRoot) {
    const requiredEntries = ['index.js', 'package.json'];
    for (const entry of requiredEntries) {
        if (!fs.existsSync(path.join(srcRoot, entry))) {
            throw new Error(`Downloaded update is missing "${entry}" — aborting before applying anything.`);
        }
    }
}

// ── Recursive sync: copies new/changed files, removes files deleted    ──
// ── upstream, and NEVER touches anything under a protected path.       ──
function syncDirectory(srcDir, destDir, relPath = '') {
    fs.mkdirSync(destDir, { recursive: true });

    const srcEntries = fs.existsSync(srcDir) ? fs.readdirSync(srcDir, { withFileTypes: true }) : [];
    const destEntries = fs.existsSync(destDir) ? fs.readdirSync(destDir, { withFileTypes: true }) : [];

    // Remove files/folders that no longer exist upstream (skip protected paths)
    for (const entry of destEntries) {
        const entryRel = path.join(relPath, entry.name);
        if (isProtected(entryRel)) continue;
        const stillExists = srcEntries.some(e => e.name === entry.name);
        if (!stillExists) {
            fs.rmSync(path.join(destDir, entry.name), { recursive: true, force: true });
            console.log(`🗑️ update: removed (deleted upstream) ${entryRel}`);
        }
    }

    // Copy new/updated files from source
    for (const entry of srcEntries) {
        const entryRel = path.join(relPath, entry.name);
        if (isProtected(entryRel)) {
            console.log(`🛡️ update: skipped protected path ${entryRel}`);
            continue;
        }
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            syncDirectory(srcPath, destPath, entryRel);
        } else {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function fileHash(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
}

// ── Update lock ─────────────────────────────────────────────────────────
// Prevents two "update" commands (or an accidental double-send) from
// running the sync/restart logic at the same time and corrupting files.
function isUpdateLocked() {
    return global.__popkidUpdateInProgress === true;
}
function setUpdateLock(value) {
    global.__popkidUpdateInProgress = value;
}

// ── Restart ────────────────────────────────────────────────────────────
// IMPORTANT: most hosting panels (Pterodactyl and similar) run the bot as
// the container's main (PID 1) process under a process supervisor that
// watches that exact process and restarts it using your configured
// "startup command" whenever it exits.
//
// The old approach here used to spawn() a detached child process and then
// exit the parent. That works fine on a bare VPS with systemd/pm2, but
// inside a panel's container it backfires: the moment the parent (PID 1)
// exits, the container itself is torn down by the runtime, which kills
// the freshly-spawned child right along with it. Net result: files get
// updated, but the bot goes offline and stays offline until you manually
// hit "restart" in the panel.
//
// The fix is to NOT try to relaunch ourselves. Just close the HTTP port
// (if any) and exit cleanly — the panel's own supervisor sees the process
// exit and restarts it using the startup command, which brings the bot
// back up running the newly-updated code. This is simpler and it's what
// panels are actually built to do.
//
// Make sure "Auto restart on stop/crash" (naming varies by panel) is
// enabled, and that your startup command / exit-code handling treats a
// clean `process.exit(0)` as something to restart on (some panels only
// auto-restart on non-zero exit codes — if yours is one of those, change
// the exit code below to 1).
function restartBot() {
    return new Promise((resolve) => {
        const doExit = () => {
            console.log('🔄 update: exiting so the panel restarts the process with the new code...');
            // Small delay so the "update installed" message has time to send.
            setTimeout(() => {
                process.exit(0); // change to process.exit(1) if your panel only auto-restarts on failure
            }, 500);
            // We never actually resolve(true)/(false) meaningfully here since
            // the process is ending, but resolve is called defensively in
            // case exit is somehow prevented (e.g. an exit hook elsewhere).
            resolve(true);
        };

        try {
            const server = global.__popkidServer;
            if (server && server.listening) {
                server.close(() => doExit());
                // Safety net: don't hang forever waiting for close() if some
                // socket refuses to release.
                setTimeout(doExit, 3000);
            } else {
                doExit();
            }
        } catch (err) {
            console.error('❌ update.js: error during restart, exiting anyway:', err.message);
            doExit();
        }
    });
}

const { cmd } = require('../arslan');

cmd({
    pattern: "update",
    name: 'update',
    category: 'Owner',
    aliases: ['upgrade', 'patch'],
    description: 'Owner only — check GitHub and update the bot in place',
    filename: __filename
}, async (sock, m, args) => {
        // ── Owner-only gate ────────────────────────────────────────────────
        if (!m.isOwner && !m.isDev) {
            return m.reply('❌ This command is restricted to the bot owner.');
        }

        if (isUpdateLocked()) {
            return m.reply('⏳ An update is already running — please wait for it to finish.');
        }
        setUpdateLock(true);

        const loadingMsg = await m.reply('🔍 *Checking for updates...*');

        const editOrSend = async (text) => {
            try {
                await sock.sendMessage(m.from, { text, edit: loadingMsg.key });
            } catch (err) {
                await sock.sendMessage(m.from, { text }, { quoted: m });
            }
        };

        let tmpDir = null;

        try {
            // 1. Check latest commit
            const latest = await getLatestCommit();
            const localSha = getLocalCommit();

            if (localSha && localSha === latest.sha) {
                setUpdateLock(false);
                return editOrSend('✅ Your bot is already up to date!');
            }

            const dateStr = latest.date ? new Date(latest.date).toLocaleString() : 'Unknown';
            await editOrSend(
                `🚀 *UPDATE FOUND!*\n\n` +
                `📝 *Changes:* ${latest.message || 'No message provided'}\n` +
                `📅 *Date:* ${dateStr}\n\n` +
                `📥 Downloading and installing update...`
            );

            // 2. Download + extract into a temp dir OUTSIDE the project
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'popkid-update-'));
            const zipPath = path.join(tmpDir, 'update.zip');
            const extractDir = path.join(tmpDir, 'extracted');
            fs.mkdirSync(extractDir, { recursive: true });

            await downloadZip(zipPath);
            const srcRoot = extractZip(zipPath, extractDir);

            // 3. Validate BEFORE touching the real project
            validateExtractedSource(srcRoot);

            // 4. Detect whether package.json actually changed
            const oldPkgHash = fileHash(path.join(PROJECT_ROOT, 'package.json'));
            const newPkgHash = fileHash(path.join(srcRoot, 'package.json'));
            const dependenciesChanged = oldPkgHash !== newPkgHash;

            // 5. Apply the update in place (protected paths are never touched)
            await editOrSend('📦 Installing files...');
            syncDirectory(srcRoot, PROJECT_ROOT);

            // 6. Install dependencies only if package.json actually changed
            if (dependenciesChanged) {
                await editOrSend('🔧 Checking dependencies...\n📦 Installing (this may take a moment)...');
                try {
                    execSync('npm install --omit=dev', { cwd: PROJECT_ROOT, stdio: 'pipe' });
                } catch (err) {
                    // Files are already updated at this point — report but don't
                    // pretend nothing happened. A manual `npm install` may be needed.
                    console.error('❌ update.js: npm install failed:', err.message);
                    await editOrSend(
                        `⚠️ Files were updated, but dependency install failed:\n${err.message}\n\n` +
                        `Run \`npm install\` manually, then restart the bot.`
                    );
                    setUpdateLock(false);
                    return;
                }
            }

            // 7. Clean up temp files
            fs.rmSync(tmpDir, { recursive: true, force: true });
            tmpDir = null;

            // 8. Save the new commit hash — only after a successful install
            saveLocalCommit(latest.sha);

            // 9. Restart — hand control back to the panel's process
            // supervisor by exiting cleanly. It relaunches the bot with the
            // startup command, which now runs the newly-installed code.
            await editOrSend(
                '✅ *Update installed successfully!*\n🔄 Restarting bot (this may take a few seconds)...'
            );

            await restartBot();
            // process.exit() runs inside restartBot(); this line is not
            // reached under normal operation.
            setUpdateLock(false);

        } catch (err) {
            console.error('❌ update.js fatal error:', err);
            if (tmpDir) {
                try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
            }
            await editOrSend(`❌ Update failed, nothing was changed:\n${err.message}`);
            setUpdateLock(false);
        }
    });
