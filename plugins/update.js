const { execSync } = require('child_process');
const path = require('path');

/**
 * Execute a command synchronously in the bot's folder.
 * Returns { success: true, output: string } or { success: false, error: string }
 */
function run(cmd) {
    try {
        const output = execSync(cmd, {
            cwd: process.cwd(),
            encoding: 'utf-8',
            stdio: 'pipe'
        }).trim();
        return { success: true, output };
    } catch (err) {
        return {
            success: false,
            error: err.stderr?.toString() || err.message || String(err)
        };
    }
}

module.exports = {
    name: 'update',
    category: 'Admin',
    aliases: ['upgrade'],
    description: "Pull the latest changes from the bot's GitHub repo and restart",

    async execute(sock, m) {
        // 1. Authorisation
        if (!global.owners.includes(m.sender)) {
            return m.reply('❌ You are not authorised to use this command.');
        }

        await m.reply('⏳ Checking for updates...');

        // 2. Verify we are inside a git repository
        const inside = run('git rev-parse --is-inside-work-tree');
        if (!inside.success) {
            return m.reply(
                '❌ This bot folder isn\'t a git repository yet.\n\n' +
                'One-time setup on your server:\n' +
                '```\ngit init\ngit remote add origin https://github.com/popkidultra/POPKID-BOT.git\ngit fetch origin\ngit checkout -f main\n```'
            );
        }

        // 3. Fetch latest from remote
        const fetch = run('git fetch origin');
        if (!fetch.success) {
            return m.reply(`❌ Failed to fetch updates:\n\`\`\`\n${fetch.error.slice(0, 400)}\n\`\`\``);
        }

        // 4. Detect default branch (usually main or master)
        let branch = 'main';
        const head = run('git symbolic-ref refs/remotes/origin/HEAD');
        if (head.success) {
            branch = head.output.split('/').pop();
        } else {
            // fallback checks
            for (const b of ['main', 'master']) {
                const check = run(`git rev-parse --verify origin/${b}`);
                if (check.success) {
                    branch = b;
                    break;
                }
            }
        }

        // 5. Check how many commits we are behind
        const behind = run(`git rev-list HEAD..origin/${branch} --count`);
        if (!behind.success) {
            return m.reply('❌ Could not compare local and remote versions.');
        }
        if (behind.output === '0') {
            return m.reply('✅ Already up to date. Nothing new to pull.');
        }

        // 6. Check for local uncommitted changes
        const status = run('git status --porcelain');
        if (status.success && status.output !== '') {
            return m.reply(
                '⚠️ You have uncommitted changes. Please commit or stash them first, then try .update again.\n\n' +
                'Quick fix:\n```\ngit add . && git commit -m "backup"\n```\n' +
                'Or to discard all local changes:\n```\ngit reset --hard origin/' + branch + '\n```'
            );
        }

        // 7. Get changelog before pulling
        const changelog = run(`git log HEAD..origin/${branch} --pretty=format:"• %s"`);
        const logText = changelog.success ? changelog.output : 'No commit messages available.';

        // 8. Detect if package.json will change
        const changedFiles = run(`git diff HEAD..origin/${branch} --name-only`);
        const needsInstall = changedFiles.success && changedFiles.output.split('\n').includes('package.json');

        // 9. Perform the pull (fast-forward when possible)
        const pull = run(`git pull origin ${branch} --no-edit`);
        if (!pull.success) {
            return m.reply(
                `❌ Update failed while pulling:\n\`\`\`\n${pull.error.slice(0, 500)}\n\`\`\`\n` +
                'Try running the following on your server:\n' +
                '```\ngit stash\ngit pull origin ' + branch + '\ngit stash pop\n```'
            );
        }

        // 10. Reinstall dependencies if needed
        let installNote = '';
        if (needsInstall) {
            await m.reply('📦 package.json changed — installing dependencies...');
            const npm = run('npm install --omit=dev');  // skip devDependencies for faster install
            if (!npm.success) {
                installNote = '\n⚠️ Dependency install failed – run `npm install` manually.';
            } else {
                installNote = '\n📦 Dependencies reinstalled.';
            }
        }

        await m.reply(
            `✅ *UPDATE COMPLETE*\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `${logText}\n` +
            `━━━━━━━━━━━━━━━━${installNote}\n` +
            `🔄 Restarting now…\n\n` +
            `© popkid`
        );

        // 11. Restart the bot
        // Use this if you have a process manager (PM2, systemd, etc.) that will restart automatically:
        setTimeout(() => process.exit(0), 1500);

        // If you run the bot directly with `node index.js` and need a self‑spawn restart,
        // uncomment the following lines instead of the above:
        // setTimeout(() => {
        //     try {
        //         const { spawn } = require('child_process');
        //         const child = spawn(process.argv[0], [path.join(process.cwd(), 'index.js')], {
        //             detached: true,
        //             stdio: 'ignore',
        //             cwd: process.cwd()
        //         });
        //         child.unref();
        //     } catch {}
        //     process.exit(0);
        // }, 1500);
    }
};
