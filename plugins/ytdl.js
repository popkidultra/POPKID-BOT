const axios = require("axios");
const yts = require("yt-search");

const newsletterContext = {
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: "120363382023564830@newsletter",
            newsletterName: "POPKID XMD",
            serverMessageId: 1
        }
    }
};

// Shared axios instance so every API call gets a timeout and a UA header —
// without this, a hung/slow API call can block the command forever.
const api = axios.create({
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
});

function isValidApiResult(json) {
    return json && typeof json === "object" && json.status && json.result && json.result.downloadUrl;
}

module.exports = {
    name: 'play',
    category: 'Download',
    aliases: ['song', 'yta', 'music'],
    description: 'Download audio from YouTube by title or URL',

    async execute(sock, m, args) {
        if (!args || !args[0]) return m.reply('❌ Please give me a title or URL.');
        const q = args.join(" ");

        // --- 1. Loading message (same pattern as ping) ---
        const loadingMsg = await m.reply('🔎 *Searching...*');

        // --- 2. Search YouTube ---
        let data;
        try {
            const search = await yts(q);
            data = search?.videos?.[0];
        } catch (err) {
            console.error('play: yt-search error:', err);
            return editOrSend(sock, m, loadingMsg, '❌ Search failed, try again.');
        }

        if (!data) return editOrSend(sock, m, loadingMsg, '❌ No results found.');

        await editOrSend(sock, m, loadingMsg, `🎵 *Found:* ${data.title}\n⬇️ Downloading audio...`);

        // --- 3. Fetch download link ---
        let apiRes;
        try {
            // Pass the resolved video URL, not the raw text query — the API's
            // own search can otherwise pick a different video than yt-search did,
            // so the audio you send won't match the title/thumbnail shown below.
            apiRes = await api.get("https://apiziaul.vercel.app/api/downloader/ytplaymp3", {
                params: { query: data.url }
            });
        } catch (apiErr) {
            console.error('play: API request failed:', apiErr.message);
            return editOrSend(sock, m, loadingMsg, '❌ Audio download API is unreachable right now, try again shortly.');
        }

        const json = apiRes.data;
        if (!isValidApiResult(json)) {
            console.error('play: bad API response:', JSON.stringify(json).slice(0, 300));
            return editOrSend(sock, m, loadingMsg, '❌ Failed to fetch audio (API returned no download link).');
        }

        const downloadUrl = json.result.downloadUrl;
        const title = json.result.title || data.title;

        // --- 4. Original play card style, kept as-is ---
        const desc = `
*⫷⦁POPKID XMD MUSⵊC DOWNLOADⵊNG⦁⫸*

🎵 *MUSIC FOUND!* 

➥ *Title:* ${data.title} 
➥ *Duration:* ${data.timestamp} 
➥ *Views:* ${data.views} 
➥ *Uploaded On:* ${data.ago} 
➥ *Link:* ${data.url} 

🎧 *ENJOY THE MUSIC!*
_By POPKID XMD_
`;

        try {
            await sock.sendMessage(m.from, { image: { url: data.thumbnail }, caption: desc, ...newsletterContext }, { quoted: m.key ? m : undefined });
            await sock.sendMessage(m.from, { audio: { url: downloadUrl }, mimetype: "audio/mpeg", ...newsletterContext }, { quoted: m.key ? m : undefined });
            await sock.sendMessage(m.from, {
                document: { url: downloadUrl },
                mimetype: "audio/mpeg",
                fileName: title + ".mp3",
                caption: "*© POPKID XMD*",
                ...newsletterContext
            }, { quoted: m.key ? m : undefined });

            // --- 5. Clean up loading message on success ---
            await editOrSend(sock, m, loadingMsg, '✅ *Done!*');
        } catch (sendErr) {
            console.error('play: send error:', sendErr);
            await editOrSend(sock, m, loadingMsg, '❌ Failed to send the audio, try again.');
        }
    }
};

// Edits the loading message like ping does, falling back to a new message
// if the WA client/baileys version doesn't support edits.
async function editOrSend(sock, m, loadingMsg, text) {
    try {
        await sock.sendMessage(m.from, { text, edit: loadingMsg.key });
    } catch (err) {
        console.error('play: edit failed, sending new message:', err.message);
        await sock.sendMessage(m.from, { text });
    }
}
