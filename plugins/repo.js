const axios = require('axios');
const fs = require('fs');

const { cmd } = require('../arslan');

cmd({
    pattern: "repo",
    name: 'repo',
    category: 'General',
    aliases: ['sourcecode', 'script', 'sc', 'github'],
    description: 'Show live POPKID BOT GitHub information',
    filename: __filename
}, async (sock, m, args) => {
        const REPO_OWNER = 'popkidultra';
        const REPO_NAME = 'POPKID-BOT';

        const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

        let stats = {
            description: 'A modern WhatsApp bot built on Baileys.',
            stars: '—',
            forks: '—',
            watchers: '—',
            issues: '—',
            language: 'JavaScript',
            license: 'MIT',
            updated: 'N/A',
            branch: 'main'
        };

        try {
            const response = await fetch(API_URL, {
                headers: {
                    'User-Agent': 'POPKID-BOT',
                    'Accept': 'application/vnd.github+json'
                }
            });

            if (response.ok) {
                const data = await response.json();

                stats = {
                    description: data.description || stats.description,
                    stars: data.stargazers_count ?? stats.stars,
                    forks: data.forks_count ?? stats.forks,
                    watchers: data.watchers_count ?? stats.watchers,
                    issues: data.open_issues_count ?? stats.issues,
                    language: data.language || stats.language,
                    license: data.license?.spdx_id || data.license?.name || stats.license,
                    updated: data.pushed_at ? new Date(data.pushed_at).toLocaleString() : stats.updated,
                    branch: data.default_branch || stats.branch
                };
            }
        } catch (error) {
            console.error('GitHub API error:', error);
        }

        const info =
`╔═ 👑 𝗣𝗢𝗣𝗞𝗜𝗗 𝗕𝗢𝗧 ═❍
║ 📝 𝗗𝗲𝘀𝗰: ${stats.description}
║ 🔗 𝗥𝗲𝗽𝗼: ${REPO_URL}
╠═════════════════❍
║ ⭐ 𝗦𝘁𝗮𝗿𝘀: ${stats.stars}
║ 🍴 𝗙𝗼𝗿𝗸𝘀: ${stats.forks}
║ 👁️ 𝗪𝗮𝘁𝗰𝗵𝗲𝗿𝘀: ${stats.watchers}
║ 🐛 𝗜𝘀𝘀𝘂𝗲𝘀: ${stats.issues}
║ 💻 𝗟𝗮𝗻𝗴: ${stats.language}
║ 📄 𝗟𝗶𝗰𝗲𝗻𝘀𝗲: ${stats.license}
║ 🌿 𝗕𝗿𝗮𝗻𝗰𝗵: ${stats.branch}
║ 🕒 𝗨𝗽𝗱𝗮𝘁𝗲𝗱: ${stats.updated}
╚═════════════════❍
> ❍ 𝗣𝗢𝗣𝗞𝗜𝗗𝗕𝗢𝗧 ❍`;

        try {
            if (!global.menuImage) throw new Error('global.menuImage is not set');

            // global.menuImage can be either a remote URL (default) or a
            // local file path saved by the .setmenuimage command.
            const imageBuffer = /^https?:\/\//i.test(global.menuImage)
                ? (await axios.get(global.menuImage, {
                    responseType: 'arraybuffer',
                    timeout: 8000
                })).data
                : fs.readFileSync(global.menuImage);

            await m.reply(imageBuffer, { caption: info });

        } catch (err) {
            console.error('Repo image error, falling back to text:', err.message);
            try {
                await sock.sendMessage(m.from, { text: info });
            } catch (err2) {
                console.error('Repo text fallback error:', err2.message);
            }
        }
    });
