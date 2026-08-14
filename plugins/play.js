import yts from 'yt-search';
import axios from 'axios';
import { sendInteractiveMessage } from 'gifted-btns';

// ────────────────────────────────
// Config
// ────────────────────────────────
const DL_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const API_KEY = 'qasim-dev';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const REQUEST_TIMEOUT_MS = 90000;
const THUMB_TIMEOUT_MS = 15000;
const FOOTER = 'popkid 🇬🇭';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ────────────────────────────────
// Helpers
// ────────────────────────────────

/**
 * Search YouTube and return the top result.
 */
async function searchSong(query) {
    const { videos } = await yts(query);
    if (!videos?.length) return null;
    return videos[0];
}

/**
 * Download a track as mp3, retrying on transient failures.
 */
async function downloadWithRetry(url, retries = MAX_RETRIES) {
    let lastErr;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { data } = await axios.get(DL_API, {
                params: { apiKey: API_KEY, format: 'mp3', url },
                timeout: REQUEST_TIMEOUT_MS
            });

            if (data?.data?.downloadUrl) return data.data;
            throw new Error('No download URL returned by API');
        } catch (err) {
            lastErr = err;
            if (attempt === retries) break;
            console.log(`[play] Download attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS / 1000}s...`);
            await wait(RETRY_DELAY_MS);
        }
    }

    throw lastErr ?? new Error('All download attempts failed');
}

/**
 * Fetch a thumbnail as a buffer; never throws — returns undefined on failure.
 */
async function fetchThumbnail(url) {
    if (!url) return undefined;
    try {
        const { data } = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: THUMB_TIMEOUT_MS
        });
        return Buffer.from(data);
    } catch {
        return undefined;
    }
}

/**
 * Translate a caught error into a user-friendly message.
 */
function describeError(err) {
    const status = err.response?.status;
    if (status === 408) return 'Download timed out. Try again in a moment.';
    if (status === 429) return 'Rate limited. Wait a minute and try again.';
    return err.message || 'Something went wrong.';
}

// ────────────────────────────────
// Command
// ────────────────────────────────
export default {
    command: 'play',
    aliases: ['plays', 'music'],
    category: 'music',
    description: 'Search and download a song as MP3 from YouTube',
    usage: '.play <song name>',

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const query = args.join(' ').trim();

        if (!query) {
            return sendInteractiveMessage(sock, chatId, {
                title: '🎵 PLAY',
                text: 'Which song do you want to play?\n\nUsage: *.play <song name>*',
                footer: FOOTER
            });
        }

        try {
            await sendInteractiveMessage(sock, chatId, {
                title: '🔍 SEARCHING',
                text: `Looking up *${query}*...`,
                footer: FOOTER
            });

            const video = await searchSong(query);
            if (!video) {
                return sendInteractiveMessage(sock, chatId, {
                    title: '❌ NO RESULTS',
                    text: `Nothing found for *${query}*.`,
                    footer: FOOTER
                });
            }

            await sendInteractiveMessage(sock, chatId, {
                title: '✅ FOUND',
                text: `*${video.title}*\n⏱️ ${video.timestamp}   👤 ${video.author.name}\n\n⏳ Downloading... (this may take up to 30s)`,
                footer: FOOTER
            });

            const songData = await downloadWithRetry(video.url);
            const thumbnailBuffer = await fetchThumbnail(songData.thumbnail);

            await sock.sendMessage(
                chatId,
                {
                    audio: { url: songData.downloadUrl },
                    mimetype: 'audio/mpeg',
                    fileName: `${songData.title}.mp3`,
                    contextInfo: {
                        externalAdReply: {
                            title: songData.title,
                            body: `${video.author.name} • ${video.timestamp}`,
                            thumbnail: thumbnailBuffer,
                            mediaType: 2,
                            sourceUrl: video.url,
                            renderLargerThumbnail: true
                        }
                    }
                },
                { quoted: message }
            );
        } catch (err) {
            console.error('[play] Error:', err.message);

            await sendInteractiveMessage(sock, chatId, {
                title: '❌ FAILED',
                text: describeError(err),
                footer: FOOTER,
                interactiveButtons: [
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: '🔁 Try Again',
                            id: `.play ${query}`
                        })
                    }
                ]
            });
        }
    }
};
