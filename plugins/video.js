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

const api = axios.create({
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
});

function isValidApiResult(json) {
    return json && typeof json === "object" && json.status && json.result && json.result.downloadUrl;
}

module.exports = {
    name: 'video',
    category: 'Download',
    aliases: ['video'],
    description: 'Download video from YouTube by title or URL',

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
            console.error('darama: yt-search error:', err);
            return editOrSend(sock, m, loadingMsg, '❌ Search failed, try again.');
        }

        if (!data) return editOrSend(sock, m, loadingMsg, '❌ No results found.');

        await editOrSend(sock, m, loadingMsg, `🎥 *Found:* ${data.title}\n⬇️ Downloading video...`);

        // --- 3. Fetch download link ---
        let apiRes;
        try {
            apiRes = await api.get("https://apiziaul.vercel.app/api/downloader/ytmp4", {
                params: { url: data.url }
            });
        } catch (apiErr) {
            console.error('darama: API request failed:', apiErr.message);
            return editOrSend(sock, m, loadingMsg, '❌ Video download API is unreachable right now, try again shortly.');
        }

        const json = apiRes.data;
        if (!isValidApiResult(json)) {
            console.error('darama: bad API response:', JSON.stringify(json).slice(0, 300));
            return editOrSend(sock, m, loadingMsg, '❌ Failed to fetch video (API returned no download link, API might be down).');
        }

        const downloadUrl = json.result.downloadUrl;
        const title = json.result.title || json.result.filename || data.title;

        // --- 4. Original darama card style, kept as-is ---
        const desc = `
*⫷⦁POPKID XMD VⵊDEO DOWNLOADⵊNG⦁⫸*

🎥 *VIDEO FOUND!* 

➥ *Title:* ${data.title} 
➥ *Duration:* ${data.timestamp} 
➥ *Views:* ${data.views} 
➥ *Uploaded On:* ${data.ago} 
➥ *Link:* ${data.url} 

🎬 *ENJOY THE VIDEO!*
_By POPKID XMD_
`;

        try {
            await sock.sendMessage(m.from, { image: { url: data.thumbnail }, caption: desc, ...newsletterContext }, { quoted: m.key ? m : undefined });
            await sock.sendMessage(m.from, { video: { url: downloadUrl }, mimetype: "video/mp4", ...newsletterContext }, { quoted: m.key ? m : undefined });
            await sock.sendMessage(m.from, {
                document: { url: downloadUrl },
                mimetype: "video/mp4",
                fileName: title + ".mp4",
                caption: "*© POPKID XMD*",
                ...newsletterContext
            }, { quoted: m.key ? m : undefined });

            // --- 5. Clean up loading message on success ---
            await editOrSend(sock, m, loadingMsg, '✅ *Done!*');
        } catch (sendErr) {
            console.error('darama: send error:', sendErr);
            await editOrSend(sock, m, loadingMsg, '❌ Failed to send the video, try again.');
        }
    }
};

// Edits the loading message like ping does, falling back to a new message
// if the WA client/baileys version doesn't support edits.
async function editOrSend(sock, m, loadingMsg, text) {
    try {
        await sock.sendMessage(m.from, { text, edit: loadingMsg.key });
    } catch (err) {
        console.error('darama: edit failed, sending new message:', err.message);
        await sock.sendMessage(m.from, { text });
    }
}
