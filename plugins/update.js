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

    async execute(sock, m, conText = {}) {
        // Safe check for owner status across various bot structures
        const isOwner = conText.isOwner || conText.isSuperUser || m.isOwner || m.key?.fromMe;

        if (!isOwner) {
            return await sock.sendMessage(m.from, { 
                text: '❌ *This command is restricted to the Bot Owner!*', 
                ...newsletterContext 
            }, { quoted: m });
        }

        let loadingMsg;
        try {
            loadingMsg = await sock.sendMessage(m.from, { 
                text: '🔍 *Checking for updates...*', 
                ...newsletterContext 
            }, { quoted: m });
        } catch (e) {
            console.error('Failed to send initial message:', e);
        }

        const repoOwnerAndName = 'popkidultra/POPKID-BOT';
        const branch = 'main';

        const zipPath = path.join(__dirname, '..', 'popkid-bot-main.zip');
        const extractPath = path.join(__dirname, '..', 'latest');

        try {
            // --- 1. Check GitHub for the latest commit ---
            const { data: commitData } = await axios.get(
                `https://api.github.com/repos/${repoOwnerAndName}/commits/${branch}`,
                { headers: { 'User-Agent': 'POPKID-BOT' } }
            );
            const latestCommitHash = commitData.sha;

            const currentHash = global.commitHash || '';
            if (currentHash && latestCommitHash === currentHash) {
                return await sock.sendMessage(m.from, {
                    text: '✅ *POPKID-BOT is already on the latest version!*',
                    edit: loadingMsg?.key,
                    ...newsletterContext
                });
            }

            const authorName = commitData.commit.author.name;
            const commitDate = new Date(commitData.commit.author.date).toLocaleString();
            const commitMessage = commitData.commit.message;

            // --- 2. Update status: Downloading files ---
            await sock.sendMessage(m.from, {
                text: `🔄 *Updating POPKID-BOT...*\n\n📌 *Commit Details:*\n👤 *Author:* ${authorName}\n📅 *Date:* ${commitDate}\n💬 *Message:* ${commitMessage}\n\n⏳ *Downloading source zip...*`,
                edit: loadingMsg?.key,
                ...newsletterContext
            });

            // --- 3. Fetch and extract repo archive ---
            const { data: zipData } = await axios.get(
                `https://github.com/${repoOwnerAndName}/archive/refs/heads/${branch}.zip`,
                { responseType: 'arraybuffer', headers: { 'User-Agent': 'POPKID-BOT' } }
            );
            fs.writeFileSync(zipPath, zipData);

            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractPath, true);

            const extractedFolders = fs.readdirSync(extractPath);
            if (!extractedFolders.length) throw new Error("Extracted folder is empty.");

            const sourcePath = path.join(extractPath, extractedFolders[0]);
            const destinationPath = path.join(__dirname, '..');

            const excludeList = [
                '.env',
                'node_modules',
                'session',
                'config.js'
            ];

            // --- 4. Replace files & update commit hash ---
            copyFolderSync(sourcePath, destinationPath, excludeList);
            global.commitHash = latestCommitHash;

            // Cleanup
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });

            // --- 5. Notify completion & restart ---
            await sock.sendMessage(m.from, {
                text: '✅ *Update complete! POPKID-BOT is restarting process...*',
                edit: loadingMsg?.key,
                ...newsletterContext
            });

            setTimeout(() => {
                process.exit(0);
            }, 2000);

        } catch (err) {
            console.error('Update command error:', err);

            // Cleanup temporary directories if failed
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });

            const errMsg = `❌ *Update Failed:* ${err.message || 'Check terminal logs for details.'}`;
            
            if (loadingMsg?.key) {
                await sock.sendMessage(m.from, { text: errMsg, edit: loadingMsg.key, ...newsletterContext });
            } else {
                await sock.sendMessage(m.from, { text: errMsg, ...newsletterContext }, { quoted: m });
            }
        }
    }
};
