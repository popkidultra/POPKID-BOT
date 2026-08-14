const axios = require('axios');
const yts = require('yt-search'); // npm i yt-search  (only needed if you want text search, not just links)

const YT_MP3_API = 'https://jerrycoder.oggyapi.workers.dev/down/ytmp3?url=';

const YOUTUBE_URL_REGEX =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/i;

// Resolve whatever the user typed into a clean YouTube video URL + basic info.
async function resolveYoutubeTarget(query) {
    const match = query.match(YOUTUBE_URL_REGEX);
    if (match) {
        const videoId = match[1];
        return {
            url: `https://youtu.be/${videoId}`,
        };
    }

    // Not a link -> treat it as a search term
    const searchResult = await yts(query);
    const video = searchResult && searchResult.videos && searchResult.videos[0];
    if (!video) {
        return null;
    }
    return {
        url: video.url,
        title: video.title,
        duration: video.timestamp,
        thumbnail: video.thumbnail,
    };
}

function formatDuration(totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds)) return 'Unknown';
    const seconds = Math.floor(totalSeconds % 60);
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

module.exports = {
    name: 'play',
    category: 'Downloader',
    aliases: ['song', 'ytmp3', 'audio'],
    description: 'Search YouTube (or paste a link) and send the audio',

    async execute(sock, m, args) {
        const query = Array.isArray(args) ? args.join(' ').trim() : String(args || '').trim();

        if (!query) {
            return sock.sendMessage(
                m.from,
                { text: '❓ *Usage:* .play <song name or YouTube link>\n\n*Example:* .play Камин EMIN & JONY' },
                { quoted: m }
            );
        }

        let loadingMsg;
        try {
            loadingMsg = await sock.sendMessage(
                m.from,
                { text: `🔎 *Searching for:* ${query}...` },
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
            // --- 1. Resolve to a real YouTube URL (search if needed) ---
            const target = await resolveYoutubeTarget(query);
            if (!target) {
                return editOrSend('❌ *No results found for that search.*');
            }

            await editOrSend(`⏳ *Found it! Fetching audio for:*\n${target.title || target.url}`);

            // --- 2. Call the conversion API ---
            const apiUrl = `${YT_MP3_API}${encodeURIComponent(target.url)}`;
            const { data } = await axios.get(apiUrl, { timeout: 30000 });

            if (!data || data.status !== 'success' || !data.url) {
                console.error('ytmp3 API returned unexpected payload:', data);
                return editOrSend('❌ *Failed to convert this video to audio. Try a different link/song.*');
            }

            const {
                title = target.title || 'Unknown title',
                duration,
                url: audioUrl,
            } = data;

            // --- 3. Download the audio into a buffer ---
            const audioResponse = await axios.get(audioUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 50 * 1024 * 1024, // 50MB safety cap
            });
            const audioBuffer = Buffer.from(audioResponse.data);

            if (!audioBuffer || audioBuffer.length === 0) {
                return editOrSend('❌ *Downloaded audio was empty. Please try again.*');
            }

            // --- 4. Send as a real playable audio message ---
            await sock.sendMessage(
                m.from,
                {
                    audio: audioBuffer,
                    mimetype: 'audio/mpeg',
                    fileName: `${title}.mp3`,
                    ptt: false, // set true if you want it sent as a voice note instead
                },
                { quoted: m }
            );

            await editOrSend(
                `✅ *Sent!*\n\n🎵 *Title:* ${title}\n⏱️ *Duration:* ${formatDuration(duration)}`
            );
        } catch (err) {
            console.error('Play command error:', err);
            const msg = `❌ *Failed to fetch/send audio:* ${err.message || 'Check logs for details.'}`;
            try {
                await editOrSend(msg);
            } catch (err2) {
                console.error('Also failed to send error message:', err2);
            }
        }
    },
};
