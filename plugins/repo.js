module.exports = {
    name: 'repo',
    category: 'General',
    aliases: ['sourcecode', 'script', 'sc', 'github'],
    description: 'Show live POPKID BOT GitHub information',

    async execute(sock, m, args) {
        const REPO_OWNER = 'popkidultra';
        const REPO_NAME = 'POPKID-BOT';

        const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

        // ─────────────────────────────
        // SMALL LOADING ANIMATION
        // ─────────────────────────────

        const frames = [
            '⏳ *Checking GitHub* ·',
            '⏳ *Checking GitHub* ··',
            '⏳ *Checking GitHub* ···',
            '🔄 *Fetching repository* ·',
            '🔄 *Fetching repository* ··',
            '🔄 *Fetching repository* ···',
            '⚡ *Loading live stats* ·',
            '⚡ *Loading live stats* ··',
            '⚡ *Loading live stats* ···'
        ];

        let loadingMsg;

        try {
            loadingMsg = await m.reply('⏳ *Checking GitHub* ·');
        } catch (err) {
            console.error('Loading message error:', err);
        }

        // ─────────────────────────────
        // START ANIMATION
        // ─────────────────────────────

        let running = true;
        let frameIndex = 0;

        const animate = async () => {
            while (running && loadingMsg) {
                try {
                    await new Promise(resolve =>
                        setTimeout(resolve, 500)
                    );

                    if (!running) break;

                    await sock.sendMessage(m.from, {
                        text: frames[frameIndex],
                        edit: loadingMsg.key
                    });

                    frameIndex =
                        (frameIndex + 1) % frames.length;

                } catch (err) {
                    running = false;
                    console.error(
                        'Loading animation error:',
                        err
                    );
                }
            }
        };

        // Run animation in background
        const animation = animate();

        // ─────────────────────────────
        // DEFAULT DATA
        // ─────────────────────────────

        let stats = {
            description:
                'A modern WhatsApp bot built on Baileys.',
            stars: '—',
            forks: '—',
            watchers: '—',
            issues: '—',
            language: 'JavaScript',
            license: 'MIT',
            updated: 'N/A',
            branch: 'main'
        };

        // ─────────────────────────────
        // FETCH LIVE GITHUB DATA
        // ─────────────────────────────

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
                    description:
                        data.description ||
                        stats.description,

                    stars:
                        data.stargazers_count ??
                        stats.stars,

                    forks:
                        data.forks_count ??
                        stats.forks,

                    watchers:
                        data.watchers_count ??
                        stats.watchers,

                    issues:
                        data.open_issues_count ??
                        stats.issues,

                    language:
                        data.language ||
                        stats.language,

                    license:
                        data.license?.spdx_id ||
                        data.license?.name ||
                        stats.license,

                    updated:
                        data.pushed_at
                            ? new Date(
                                data.pushed_at
                            ).toLocaleString()
                            : stats.updated,

                    branch:
                        data.default_branch ||
                        stats.branch
                };
            }

        } catch (error) {
            console.error(
                'GitHub API error:',
                error
            );
        }

        // ─────────────────────────────
        // STOP ANIMATION
        // ─────────────────────────────

        running = false;

        try {
            await animation;
        } catch (_) {}

        // ─────────────────────────────
        // FINAL MESSAGE
        // ─────────────────────────────

        const info =
`╭─〔 *📦 POPKID BOT* 〕─╮
│
│ 📝 ${stats.description}
│
│ ⭐ *Stars:* ${stats.stars}
│ 🍴 *Forks:* ${stats.forks}
│ 👁️ *Watchers:* ${stats.watchers}
│ 🐛 *Issues:* ${stats.issues}
│ 💻 *Language:* ${stats.language}
│ 📄 *License:* ${stats.license}
│ 🌿 *Branch:* ${stats.branch}
│ 🕒 *Updated:* ${stats.updated}
│
│ 🔗 *Repo:*
│ ${REPO_URL}
│
│ 🍴 *Fork:*
│ ${REPO_URL}/fork
│
╰─〔 *POPKID MD* 〕─╯`;

        // ─────────────────────────────
        // EDIT LOADING MESSAGE
        // ─────────────────────────────

        if (loadingMsg) {
            try {
                await sock.sendMessage(m.from, {
                    text: info,
                    edit: loadingMsg.key
                });

                return;
            } catch (error) {
                console.error(
                    'Message edit error:',
                    error
                );
            }
        }

        // Fallback
        await sock.sendMessage(m.from, {
            text: info
        });
    }
};
