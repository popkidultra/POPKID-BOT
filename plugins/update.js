const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// Repository Configuration
const REPO_OWNER = 'popkidultra';
const REPO_NAME = 'POPKID-BOT';
const BRANCH = 'main';
const GITHUB_REPO = `${REPO_OWNER}/${REPO_NAME}`;

// Tracking file for the currently installed commit SHA
const COMMIT_FILE = path.join(process.cwd(), '.current_commit');

/**
 * Get current commit hash saved locally
 */
function getInstalledCommitHash() {
    try {
        if (fs.existsSync(COMMIT_FILE)) {
            return fs.readFileSync(COMMIT_FILE, 'utf-8').trim();
        }
    } catch (err) {
        console.error('Error reading commit hash file:', err.message);
    }
    return null;
}

/**
 * Save new commit hash locally
 */
function setInstalledCommitHash(hash) {
    try {
        fs.writeFileSync(COMMIT_FILE, hash.trim(), 'utf-8');
    } catch (err) {
        console.error('Error writing commit hash file:', err.message);
    }
}

/**
 * Recursively copy files while respecting protected items
 */
function copyDirectorySync(src, dest, excludeList = []) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Normalize paths for matching against exclude list
        const relativePath = path.relative(process.cwd(), destPath).replace(/\\/g, '/');
        
        const isExcluded = excludeList.some(item => {
            const normalizedItem = item.replace(/\\/g, '/');
            return relativePath === normalizedItem || relativePath.startsWith(normalizedItem + '/');
        });

        if (isExcluded) {
            continue;
        }

        if (entry.isDirectory()) {
            copyDirectorySync(srcPath, destPath, excludeList);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

module.exports = {
    name: 'update',
    category: 'Owner',
    aliases: ['updatenow', 'updt', 'sync', 'update now'],
    description: 'Check GitHub and update POPKID-BOT to the latest version.',

    async execute(sock, m, args, context = {}) {
        const chatId = context.chatId || m.key.remoteJid || m.from;

        // Owner Authorization Check
        const isOwner = context.isOwner || context.isSuperUser || m.isOwner;
        if (!isOwner) {
            return await sock.sendMessage(chatId, { 
                text: '❌ *Owner Only Command!*' 
            }, { quoted: m });
        }

        const zipPath = path.join(process.cwd(), 'temp_update.zip');
        const extractPath = path.join(process.cwd(), 'temp_extracted');

        try {
            await sock.sendMessage(chatId, { text: '🔍 *Checking for New Updates...*' }, { quoted: m });

            // 1. Fetch latest commit details from GitHub API
            const commitApiUrl = `https://api.github.com/repos/${GITHUB_REPO}/commits/${BRANCH}`;
            const { data: commitData } = await axios.get(commitApiUrl, {
                headers: { 'User-Agent': 'POPKID-BOT-Updater' },
                timeout: 15000
            });

            const latestCommitHash = commitData.sha;
            const currentHash = getInstalledCommitHash();

            // 2. Compare SHAs
            if (currentHash && currentHash === latestCommitHash) {
                return await sock.sendMessage(chatId, { 
                    text: '✅ *Your POPKID-BOT is already on the latest version!*' 
                }, { quoted: m });
            }

            // Extract Metadata
            const authorName = commitData.commit.author.name || 'Unknown';
            const authorEmail = commitData.commit.author.email || 'N/A';
            const commitDate = new Date(commitData.commit.author.date).toLocaleString();
            const commitMessage = commitData.commit.message || 'No commit message provided.';

            await sock.sendMessage(chatId, {
                text: `🔄 *Updating POPKID-BOT...*\n\n` +
                      `*Commit Details:*\n` +
                      `👤 *Author:* ${authorName} (${authorEmail})\n` +
                      `📅 *Date:* ${commitDate}\n` +
                      `💬 *Message:* ${commitMessage}\n\n` +
                      `⏳ *Downloading & extracting source files...*`
            }, { quoted: m });

            // 3. Download Main Branch ZIP
            const zipUrl = `https://github.com/${GITHUB_REPO}/archive/refs/heads/${BRANCH}.zip`;
            const { data: zipBuffer } = await axios.get(zipUrl, {
                responseType: 'arraybuffer',
                timeout: 60000
            });

            fs.writeFileSync(zipPath, zipBuffer);

            // 4. Extract Zip
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractPath, true);

            // Zip extracts into root folder: POPKID-BOT-main
            const extractedSourcePath = path.join(extractPath, `${REPO_NAME}-${BRANCH}`);

            if (!fs.existsSync(extractedSourcePath)) {
                throw new Error(`Extracted path not found: ${extractedSourcePath}`);
            }

            // 5. Define Protected Files/Folders to Exclude from Overwriting
            const excludeList = [
                '.env',
                'session',
                'sessions',
                'database.db',
                'database.json',
                'config.env',
                '.current_commit',
                'temp_update.zip',
                'temp_extracted'
            ];

            // 6. Copy updated files in-place
            copyDirectorySync(extractedSourcePath, process.cwd(), excludeList);

            // 7. Save New Commit SHA
            setInstalledCommitHash(latestCommitHash);

            // 8. Cleanup Temporary Directories
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });

            // 9. Notify Owner & Trigger Restart
            await sock.sendMessage(chatId, { 
                text: '✅ *Update Complete!*\n🔄 *Bot is restarting to apply changes...*' 
            }, { quoted: m });

            setTimeout(() => {
                process.exit(0);
            }, 2000);

        } catch (error) {
            console.error('POPKID-BOT Update Error:', error);

            // Cleanup temp files on failure
            try {
                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
            } catch (cleanupErr) {
                console.error('Error cleaning up temporary update files:', cleanupErr.message);
            }

            await sock.sendMessage(chatId, { 
                text: '❌ *Update Failed.* Please check server logs or redeploy manually.' 
            }, { quoted: m });
        }
    }
};
