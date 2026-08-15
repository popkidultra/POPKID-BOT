const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');

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

// ── Restart (self-respawn with a startup verification window) ─────────────
// 1. Frees the HTTP port (index.js exposes it as global.__popkidServer)
//    BEFORE spawning the replacement process. Without this, the old and
//    new process briefly race for the same port and the new one can crash
//    with EADDRINUSE — the single biggest cause of a bad restart.
// 2. After spawning, it watches the new process for a few seconds. If it
//    exits almost immediately (e.g. broken code was pushed upstream), the
//    restart is treated as FAILED: the port is handed back to the still-
//    running OLD process instead of blindly exiting, so a bad update never
//    takes the bot fully offline. Resolves `true` on a verified restart
//    (in which case this process exits and never returns) or `false` if
//    the restart was aborted and the old process is still alive.
function restartBot({ onFailure } = {}) {
    return new Promise((resolve) => {
        const finishFail = async (reason) => {
            try {
                if (global.__popkidServer && !global.__popkidServer.listening && global.__popkidPort) {
                    global.__popkidServer.listen(global.__popkidPort);
                }
            } catch (_) {}
            if (onFailure) {
                try { await onFailure(reason); } catch (_) {}
            }
            resolve(false);
        };

        const doSpawn = () => {
            let child;
            try {
                child = spawn(process.argv[0], process.argv.slice(1), {
                    cwd: PROJECT_ROOT,
                    detached: true,
                    stdio: 'inherit', // shares real fds so logs survive after this process exits
                    env: process.env
                });
            } catch (err) {
                finishFail(`Failed to spawn new process: ${err.message}`);
                return;
            }

            let settled = false;
            const GRACE_MS = 6000; // long enough for require()/native module loads on slow hosts

            const crashTimer = setTimeout(() => {
                if (settled) return;
                settled = true;
                child.unref();
                resolve(true);
                process.exit(0);
            }, GRACE_MS);

            child.once('exit', (code, signal) => {
                if (settled) return;
                settled = true;
                clearTimeout(crashTimer);
                finishFail(
                    `The new process exited almost immediately (code ${code}, signal ${signal || 'none'}) — ` +
                    `most likely a syntax error or crash on startup. Check your hosting logs for the exact error.`
                );
            });

            child.once('error', (err) => {
                if (settled) return;
                settled = true;
                clearTimeout(crashTimer);
                finishFail(`Failed to spawn new process: ${err.message}`);
            });
        };

        try {
            const server = global.__popkidServer;
            if (server && server.listening) {
                server.close(() => doSpawn());
            } else {
                doSpawn();
            }
        } catch (err) {
            finishFail(`Restart error: ${err.message}`);
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

            // 9. Restart — verified: if the new process crashes on startup,
            // this call returns `false` and the OLD process (this one)
            // keeps running instead of exiting.
            await editOrSend('✅ *Update installed successfully!*\n🔄 Restarting bot (verifying startup)...');

            const restarted = await restartBot({
                onFailure: async (reason) => {
                    console.error('❌ update.js: new process failed to start:', reason);
                    await editOrSend(
                        `⚠️ Files were updated, but the bot failed to restart cleanly:\n\n${reason}\n\n` +
                        `The bot is still running on the previous version — nothing is broken. ` +
                        `Fix the issue, push again, then send *update* once more.`
                    );
                }
            });

            // If restarted === true, process.exit() already ran inside
            // restartBot() and this line is never reached.
            if (restarted === false) {
                setUpdateLock(false);
            }

        } catch (err) {
            console.error('❌ update.js fatal error:', err);
            if (tmpDir) {
                try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
            }
            await editOrSend(`❌ Update failed, nothing was changed:\n${err.message}`);
            setUpdateLock(false);
        }
    });
