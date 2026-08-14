const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const newsletterContext = {
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363426778975572@newsletter',
            newsletterName: 'POPKID XMD',
            serverMessageId: 1
        }
    }
};

// Helper function to sync updated files recursively
function copyFolderSync(from, to, exclude = []) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    const element = fs.readdirSync(from);

    for (const item of element) {
        const srcPath = path.join(from, item);
        const destPath = path.join(to, item);

        const relativePath = path.relative(from, srcPath);
        if (exclude.some(ex => relativePath === ex || relativePath.startsWith(ex + path.sep))) {
            continue;
        }

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
    description: 'Update POPKID-BOT to the latest version from GitHub',

    async execute(sock, m, args) {
        // --- 1. Send loading message ---
        const loadingMsg = await m.reply('🔍 *Checking for updates...*');

        const repoOwnerAndName = 'popkidultra/POPKID-BOT';
        const branch = 'main';

        try {
            // --- 2. Check GitHub for the latest commit ---
            const { data: commitData } = await axios.get(
                `https://api.github.com/repos/${repoOwnerAndName}/commits/${branch}`
            );
            const latestCommitHash = commitData.sha;

            const currentHash = global.commitHash || '';
            if (currentHash && latestCommitHash === currentHash) {
                return await sock.sendMessage(m.from, {
                    text: '✅ *POPKID-BOT is already on the latest version!*',
                    edit: loadingMsg.key,
                    ...newsletterContext
                });
            }

            const authorName = commitData.commit.author.name;
            const commitDate = new Date(commitData.commit.author.date).toLocaleString();
            const commitMessage = commitData.commit.message;

            // --- 3. Update status: Downloading files ---
            await sock.sendMessage(m.from, {
                text: `🔄 *Updating POPKID-BOT...*\n\n📌 *Commit Details:*\n👤 *Author:* ${authorName}\n📅 *Date:* ${commitDate}\n💬 *Message:* ${commitMessage}\n\n⏳ *Downloading source zip...*`,
                edit: loadingMsg.key,
                ...newsletterContext
            });

            // --- 4. Fetch and extract repo archive ---
            const zipPath = path.join(__dirname, '..', 'popkid-bot-main.zip');
            const { data: zipData } = await axios.get(
                `https://github.com/${repoOwnerAndName}/archive/refs/heads/${branch}.zip`,
                { responseType: 'arraybuffer' }
            );
            fs.writeFileSync(zipPath, zipData);

            const extractPath = path.join(__dirname, '..', 'latest');
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractPath, true);

            const sourcePath = path.join(extractPath, 'POPKID-BOT-main');
            const destinationPath = path.join(__dirname, '..');

            // Do not overwrite sensitive configuration or local state
            const excludeList = [
                '.env',
                'node_modules',
                'session',
                'config.js'
            ];

            // --- 5. Replace files & update commit hash ---
            copyFolderSync(sourcePath, destinationPath, excludeList);
            global.commitHash = latestCommitHash;

            // Cleanup extracted folders
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });

            // --- 6. Notify completion & trigger restart ---
            await sock.sendMessage(m.from, {
                text: '✅ *Update complete! POPKID-BOT is restarting process...*',
                edit: loadingMsg.key,
                ...newsletterContext
            });

            setTimeout(() => {
                process.exit(0);
            }, 2000);

        } catch (err) {
            console.error('Update command error:', err);

            // Fallback error editing/messaging
            try {
                await sock.sendMessage(m.from, {
                    text: `❌ *Update Failed:* ${err.message || 'Check logs for details.'}`,
                    edit: loadingMsg.key,
                    ...newsletterContext
                });
            } catch (err2) {
                await sock.sendMessage(m.from, {
                    text: '❌ *Failed to update bot.*',
                    ...newsletterContext
                }, { quoted: m });
            }
        }
    }
};
