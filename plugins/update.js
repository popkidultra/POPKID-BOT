const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd: process.cwd(), windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
            resolve((stdout || '').toString());
        });
    });
}

async function hasGitRepo() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return false;
    try { await run('git --version'); return true; } catch { return false; }
}

async function updateViaGit() {
    const oldRev = String(await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
    await run('git fetch --all --prune');

    let branch = 'main';
    try {
        const head = String(await run('git symbolic-ref refs/remotes/origin/HEAD')).trim();
        branch = head.split('/').pop();
    } catch {
        try { await run('git rev-parse --verify origin/main'); branch = 'main'; }
        catch { try { await run('git rev-parse --verify origin/master'); branch = 'master'; } catch {} }
    }

    const newRev = String(await run(`git rev-parse origin/${branch}`)).trim();
    const alreadyUpToDate = oldRev === newRev;

    const commits = alreadyUpToDate ? '' : await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
    const files = alreadyUpToDate ? '' : await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');

    if (!alreadyUpToDate) {
        await run(`git reset --hard ${newRev}`);
        await run('git clean -fd -e session -e .env -e node_modules');
    }

    return { oldRev, newRev, alreadyUpToDate, commits, files };
}

function downloadFile(url, dest, visited = new Set()) {
    return new Promise((resolve, reject) => {
        try {
            if (visited.has(url) || visited.size > 5) {
                return reject(new Error('Too many redirects'));
            }
            visited.add(url);
            const client = url.startsWith('https://') ? https : http;
            const req = client.get(url, {
                headers: { 'User-Agent': 'PopkidBot-Updater/1.0', 'Accept': '*/*' }
            }, (res) => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const location = res.headers.location;
                    if (!location) return reject(new Error(`HTTP ${res.statusCode} without Location`));
                    const nextUrl = new URL(location, url).toString();
                    res.resume();
                    return downloadFile(nextUrl, dest, visited).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }
                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
                file.on('error', (err) => {
                    try { file.close(() => {}); } catch {}
                    fs.unlink(dest, () => reject(err));
                });
            });
            req.on('error', (err) => fs.unlink(dest, () => reject(err)));
        } catch (e) {
            reject(e);
        }
    });
}

async function extractZip(zipPath, outDir) {
    if (process.platform === 'win32') {
        const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`;
        await run(cmd);
        return;
    }
    try { await run('command -v unzip'); await run(`unzip -o '${zipPath}' -d '${outDir}'`); return; } catch {}
    try { await run('command -v 7z'); await run(`7z x -y '${zipPath}' -o'${outDir}'`); return; } catch {}
    try { await run('busybox unzip -h'); await run(`busybox unzip -o '${zipPath}' -d '${outDir}'`); return; } catch {}
    throw new Error("No system unzip tool found (unzip/7z/busybox). Git mode is recommended on this host.");
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) {
            copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        } else {
            fs.copyFileSync(s, d);
            outList.push(path.join(relative, entry).replace(/\\/g, '/'));
        }
    }
}

async function updateViaZip(zipOverride) {
    const zipUrl = (zipOverride || global.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
    if (!zipUrl) {
        throw new Error('No ZIP URL configured. Set global.updateZipUrl in config.js or the UPDATE_ZIP_URL env var.');
    }

    const tmpDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, 'update.zip');

    await downloadFile(zipUrl, zipPath);

    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);

    const [root] = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
    const srcRoot = root && fs.existsSync(root) && fs.lstatSync(root).isDirectory() ? root : extractTo;

    const ignore = ['node_modules', '.git', 'session', 'temp', '.env'];

    // Preserve this deployment's own owner/dev/name settings — the fetched
    // config.js is whatever's committed in the repo, which may not match
    // what this instance is actually running with.
    let preserved = {};
    try {
        delete require.cache[require.resolve(path.join(process.cwd(), 'config.js'))];
        const before = fs.readFileSync(path.join(process.cwd(), 'config.js'), 'utf8');
        const grab = (re) => (before.match(re) || [])[0] || null;
        preserved.owners = grab(/global\.owners\s*=\s*\[[^\]]*\];?/);
        preserved.dev = grab(/global\.dev\s*=\s*\[[^\]]*\];?/);
        preserved.ownerName = grab(/global\.ownerName\s*=\s*'[^']*';?/);
    } catch {}

    const copied = [];
    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);

    if (preserved.owners || preserved.dev || preserved.ownerName) {
        try {
            const settingsPath = path.join(process.cwd(), 'config.js');
            let text = fs.readFileSync(settingsPath, 'utf8');
            if (preserved.owners) text = text.replace(/global\.owners\s*=\s*\[[^\]]*\];?/, preserved.owners);
            if (preserved.dev) text = text.replace(/global\.dev\s*=\s*\[[^\]]*\];?/, preserved.dev);
            if (preserved.ownerName) text = text.replace(/global\.ownerName\s*=\s*'[^']*';?/, preserved.ownerName);
            fs.writeFileSync(settingsPath, text);
        } catch {}
    }

    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}

    return { copiedFiles: copied };
}

async function restartProcess() {
    if (fs.existsSync('/.dockerenv')) {
        setTimeout(() => process.exit(1), 500);
        return;
    }
    try { await run('pm2 restart all'); return; } catch {}
    try {
        const child = spawn(process.execPath, process.argv.slice(1), {
            detached: true, stdio: 'ignore', cwd: process.cwd(), env: process.env
        });
        child.unref();
        setTimeout(() => process.exit(0), 1500);
        return;
    } catch {}
    setTimeout(() => process.exit(0), 500);
}

module.exports = {
    name: 'update',
    category: 'Admin',
    aliases: ['upgrade'],
    description: 'Update the bot from git or a zip source, then restart',

    async execute(sock, m, args) {
        if (!global.owners.includes(m.sender)) return;

        try {
            await m.reply('🔄 Updating the bot, please wait…');

            let changesSummary = '';

            if (await hasGitRepo()) {
                const { oldRev, newRev, alreadyUpToDate, commits, files } = await updateViaGit();

                if (alreadyUpToDate) {
                    changesSummary = `✅ Already up to date\nCurrent: ${newRev.substring(0, 7)}`;
                } else {
                    changesSummary = `✅ Updated successfully!\n\n📌 Old: ${oldRev.substring(0, 7)}\n📌 New: ${newRev.substring(0, 7)}\n\n`;
                    if (commits) {
                        const lines = String(commits).split('\n').filter(Boolean).slice(0, 5);
                        changesSummary += `📝 Recent commits:\n${lines.map(c => `• ${c}`).join('\n')}\n\n`;
                    }
                    if (files) {
                        const allLines = String(files).split('\n').filter(Boolean);
                        const shown = allLines.slice(0, 10);
                        changesSummary += `📁 Changed files:\n${shown.map(f => `• ${f}`).join('\n')}`;
                        if (allLines.length > 10) changesSummary += `\n... and ${allLines.length - 10} more`;
                    }
                    await run('npm install --no-audit --no-fund').catch(() => {});
                }
            } else {
                const zipOverride = args[0] || null;
                const { copiedFiles } = await updateViaZip(zipOverride);

                changesSummary = `✅ Updated from ZIP!\n\n📁 Files updated: ${copiedFiles.length}\n\n`;
                if (copiedFiles.length > 0) {
                    const shown = copiedFiles.slice(0, 10);
                    changesSummary += `Recent changes:\n${shown.map(f => `• ${f}`).join('\n')}`;
                    if (copiedFiles.length > 10) changesSummary += `\n... and ${copiedFiles.length - 10} more files`;
                }
                await run('npm install --no-audit --no-fund').catch(() => {});
            }

            try {
                const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
                changesSummary += `\n\n🔖 Version: ${pkg.version || 'unknown'}`;
            } catch {}

            await m.reply(`${changesSummary}\n\n♻️ Restarting bot...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await restartProcess();

        } catch (err) {
            console.error('Update failed:', err);
            await m.reply(`❌ Update failed:\n${String(err.message || err)}`);
        }
    }
};
