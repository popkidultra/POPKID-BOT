const { sendButtons, sendInteractiveMessage } = require('gifted-btns');

/**
 * === repo.js ===
 * Shows POPKID BOT's source repo as an animated "live" loading card,
 * then a final info card with image + Fork / Repo / Issues buttons.
 */

const REPO_OWNER = 'popkidultra';
const REPO_NAME = 'POPKID-BOT';
const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
const FORK_URL = `${REPO_URL}/fork`;
const ISSUES_URL = `${REPO_URL}/issues`;
const REPO_IMAGE = 'https://i.ibb.co/WNv1hWXT/file-000000001f5c81f4a38f20223ae695d1.png';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Braille spinner frames — smooth, low-flicker motion when edited in place
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function buildProgressBar(percent, size = 18) {
    const filled = Math.round((percent / 100) * size);
    return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

function buildLoadingFrame(spinner, percent, label) {
    return [
        '```',
        `${spinner}  ${label}`,
        `[${buildProgressBar(percent)}] ${percent}%`,
        '```'
    ].join('\n');
}

async function fetchRepoStats() {
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`, {
            headers: { 'User-Agent': 'POPKID-BOT' }
        });
        if (!res.ok) throw new Error(`GitHub API status ${res.status}`);
        const data = await res.json();
        return {
            description: data.description || 'No description provided.',
            stars: data.stargazers_count ?? 0,
            forks: data.forks_count ?? 0,
            watchers: data.watchers_count ?? 0,
            openIssues: data.open_issues_count ?? 0,
            language: data.language || 'JavaScript',
            license: data.license?.spdx_id || data.license?.name || 'MIT',
            defaultBranch: data.default_branch || 'main',
            updatedAt: data.pushed_at ? new Date(data.pushed_at).toLocaleDateString() : 'N/A'
        };
    } catch (err) {
        console.log('⚠️ repo.js: falling back to static stats —', err.message);
        return {
            description: 'A modern WhatsApp bot built on Baileys.',
            stars: '—', forks: '—', watchers: '—', openIssues: '—',
            language: 'JavaScript', license: 'MIT', defaultBranch: 'main', updatedAt: 'N/A'
        };
    }
}

module.exports = {
    name: 'repo',
    aliases: ['sourcecode', 'script', 'sc', 'github'],
    description: 'Show POPKID BOT\'s source code, stats, and a fork link',
    category: 'info',

    async execute(sock, m, args) {
        const chatId = m.from;

        // ── 1. Live loading animation: one message, edited in place ──────────
        const stages = [
            { percent: 20, label: 'Connecting to GitHub…' },
            { percent: 45, label: 'Fetching repository data…' },
            { percent: 70, label: 'Reading commit stats…' },
            { percent: 90, label: 'Building preview card…' },
            { percent: 100, label: 'Done!' }
        ];

        const loadingMsg = await sock.sendMessage(
            chatId,
            { text: buildLoadingFrame(SPINNER_FRAMES[0], 0, 'Initializing…') },
            { quoted: m }
        );

        // Kick off the stats fetch in parallel with the animation so we
        // aren't just spinning for show — the wait is doing real work.
        const statsPromise = fetchRepoStats();

        let frame = 0;
        for (const stage of stages) {
            await sleep(450);
            frame = (frame + 1) % SPINNER_FRAMES.length;
            try {
                await sock.sendMessage(chatId, {
                    text: buildLoadingFrame(SPINNER_FRAMES[frame], stage.percent, stage.label),
                    edit: loadingMsg.key
                });
            } catch (err) {
                // Edits can silently fail on some clients — animation is
                // cosmetic, so we just move on rather than crash the command.
                console.log('⚠️ repo.js edit frame failed:', err.message);
            }
        }

        const stats = await statsPromise;

        // ── 2. Final info card (image + caption) ─────────────────────────────
        const caption = [
            `📦 *${REPO_NAME}*`,
            '',
            `${stats.description}`,
            '',
            `⭐ Stars: *${stats.stars}*`,
            `🍴 Forks: *${stats.forks}*`,
            `👁️ Watchers: *${stats.watchers}*`,
            `🐛 Open Issues: *${stats.openIssues}*`,
            `🗂️ Language: *${stats.language}*`,
            `📄 License: *${stats.license}*`,
            `🌿 Branch: *${stats.defaultBranch}*`,
            `🕒 Last updated: *${stats.updatedAt}*`,
            '',
            `🔗 ${REPO_URL}`
        ].join('\n');

        await sock.sendMessage(chatId, {
            image: { url: REPO_IMAGE },
            caption,
            edit: loadingMsg.key
        }).catch(async () => {
            // Some clients can't edit text → media in place; fall back to a
            // fresh media message if the edit itself is rejected.
            await sock.sendMessage(chatId, { image: { url: REPO_IMAGE }, caption }, { quoted: m });
        });

        // ── 3. Buttons: Fork / View Repo / Report Issue ──────────────────────
        await sendInteractiveMessage(sock, chatId, {
            text: '🚀 Want to contribute or run your own instance?',
            footer: 'POPKID BOT — open source on GitHub',
            interactiveButtons: [
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '🍴 Fork Repo',
                        url: FORK_URL
                    })
                },
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '📂 View Repo',
                        url: REPO_URL
                    })
                },
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '🐛 Report Issue',
                        url: ISSUES_URL
                    })
                }
            ]
        }).catch(async (err) => {
            // Fallback for clients/libs where sendInteractiveMessage isn't
            // supported — degrade to the simpler sendButtons variant.
            console.log('⚠️ repo.js interactive buttons failed, falling back:', err.message);
            await sendButtons(sock, chatId, {
                title: '📦 ' + REPO_NAME,
                text: '🚀 Want to contribute or run your own instance?',
                footer: 'POPKID BOT — open source on GitHub',
                buttons: [
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🍴 Fork Repo', url: FORK_URL }) },
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '📂 View Repo', url: REPO_URL }) }
                ]
            });
        });
    }
};
