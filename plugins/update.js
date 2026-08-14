const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// ---- CONFIGURE THESE FOR YOUR BOT ----
const REPO_OWNER_AND_NAME = 'popkidultra/POPKID-BOT';
const BRANCH = 'main';
const BOT_NAME = 'POPKID-BOT'; // used only in messages
// ---------------------------------------

// Where we persist the last-installed commit hash so it survives restarts
// (relying on a plain `global.commitHash` loses the value every time the process exits)
const HASH_FILE = path.join(__dirname, '..', '.commit-hash.json');

function getCommitHash() {
    try {
        if (fs.existsSync(HASH_FILE)) {
            const data = JSON.parse(fs.readFileSync(HASH_FILE, 'utf8'));
            return data.hash || '';
        }
    } catch (e) {
        console.error('Failed to read commit hash file:', e);
    }
    return '';
}

function setCommitHash(hash) {
    try {
        fs.writeFileSync(HASH_FILE, JSON.stringify({ hash }, null, 2));
        global.commitHash = hash; // keep in-memory copy too, in case other code reads it
    } catch (e) {
        console.error('Failed to write commit hash file:', e);
    }
}

// Recursively copy files from the freshly downloaded repo over the current bot files,
// skipping anything in excludeList so we never clobber local config/session/data.
function copyFolderSync(from, to, exclude = []) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    const items = fs.readdirSync(from);

    for (const item of items) {
        const srcPath = path.join(from, item);
        const destPath = path.join(to, item);
        const relativePath = path.relative(from, srcPath);

        const isExcluded = exclude.some(
            (ex) => relativePath === ex || relativePath.startsWith(ex + path.sep)
        );
        if (isExcluded) continue;

        const stat = fs.lstatSync(srcPath);
        if (stat.isDirectory()) {
            copyFolderSync(srcPath, destPath, exclude);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

module.exports = {
    name: 'update',
    category: 'Owner',
    aliases: ['updatenow', 'updt', 'sync'],
    description: `Update ${BOT_NAME} to the latest version from GitHub`,

    async execute(sock, m, args) {
        // --- Optional: restrict to bot owner only ---
        // if (!m.isOwner) {
        //     return sock.sendMessage(m.from, { text: '❌ Owner Only Command!' }, { quoted: m });
        // }

        let loadingMsg;
        try {
            loadingMsg = await sock.sendMessage(
                m.from,
                { text: '🔍 *Checking for updates...*' },
                { quoted: m }
            );
        } catch (e) {
            console.error('Failed to send loading message:', e);
        }

        const editOrSend = async (text) => {
            if (loadingMsg && loadingMsg.key) {
                return sock.sendMessage(m.from, { text, edit: loadingMsg.key });
            }
            return sock.sendMessage(m.from, { text }, { quoted: m });
        };

        try {
            // --- 1. Check GitHub for the latest commit ---
            const { data: commitData } = await axios.get(
                `https://api.github.com/repos/${REPO_OWNER_AND_NAME}/commits/${BRANCH}`,
                { timeout: 15000 }
            );
            const latestCommitHash = commitData.sha;
            const currentHash = getCommitHash();

            if (currentHash && latestCommitHash === currentHash) {
                return editOrSend(`✅ *${BOT_NAME} is already on the latest version!*`);
            }

            const authorName = commitData.commit.author.name;
            const commitDate = new Date(commitData.commit.author.date).toLocaleString();
            const commitMessage = commitData.commit.message;

            await editOrSend(
                `🔄 *Updating ${BOT_NAME}...*\n\n` +
                `📌 *Commit Details:*\n` +
                `👤 *Author:* ${authorName}\n` +
                `📅 *Date:* ${commitDate}\n` +
                `💬 *Message:* ${commitMessage}\n\n` +
                `⏳ *Downloading source zip...*`
            );

            // --- 2. Download and extract the repo archive ---
            const zipPath = path.join(__dirname, '..', 'update-download.zip');
            const { data: zipData } = await axios.get(
                `https://github.com/${REPO_OWNER_AND_NAME}/archive/refs/heads/${BRANCH}.zip`,
                { responseType: 'arraybuffer', timeout: 60000 }
            );
            fs.writeFileSync(zipPath, zipData);

            const extractPath = path.join(__dirname, '..', 'latest');
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractPath, true);

            // GitHub zips extract into "<repo-name>-<branch>"
            const repoName = REPO_OWNER_AND_NAME.split('/')[1];
            const sourcePath = path.join(extractPath, `${repoName}-${BRANCH}`);
            const destinationPath = path.join(__dirname, '..');

            if (!fs.existsSync(sourcePath)) {
                throw new Error(
                    `Extracted folder not found at ${sourcePath}. Check REPO_OWNER_AND_NAME/BRANCH.`
                );
            }

            // --- 3. Copy new files over old ones, protecting local-only files ---
            const excludeList = [
                '.env',
                'node_modules',
                'session',
                'config.js',
                '.commit-hash.json',
                'database',
            ];
            copyFolderSync(sourcePath, destinationPath, excludeList);
            setCommitHash(latestCommitHash);

            // --- 4. Cleanup ---
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });

            // --- 5. Notify and restart ---
            await editOrSend(`✅ *Update complete! ${BOT_NAME} is restarting...*`);

            setTimeout(() => {
                process.exit(0);
            }, 2000);
        } catch (err) {
            console.error('Update command error:', err);
            const msg = `❌ *Update Failed:* ${err.message || 'Check logs for details.'}`;
            try {
                await editOrSend(msg);
            } catch (err2) {
                console.error('Also failed to send error message:', err2);
            }
        }
    },
};
