const yts = require('yt-search');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const { cmd } = require('../arslan');

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB guard to avoid WhatsApp limits & OOM
const DOWNLOAD_TIMEOUT = 3 * 60 * 1000; // 3 minutes

function sanitizeFilename(name) {
    return name.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 140);
}

function tmpFilePath(prefix = 'popkid') {
    const id = crypto.randomBytes(6).toString('hex');
    return path.join(os.tmpdir(), `${prefix}-${Date.now()}-${id}.mp3`);
}

function ffmpegConvertToFile(ytdlStream, outPath) {
    return new Promise((resolve, reject) => {
        const proc = ffmpeg(ytdlStream)
            .noVideo()
            .format('mp3')
            .audioBitrate(128)
            .on('error', err => {
                reject(err);
            })
            .on('end', () => resolve())
            .save(outPath);

        // safety: if ffmpeg hangs, kill after timeout
        const timeout = setTimeout(() => {
            try { proc.kill('SIGKILL'); } catch (e) { /* ignore */ }
            reject(new Error('Transcoding timeout'));
        }, DOWNLOAD_TIMEOUT);

        // clear timeout on finish/error
        proc.on('end', () => clearTimeout(timeout));
        proc.on('error', () => clearTimeout(timeout));
    });
}

cmd({
    pattern: "play",
    name: 'play',
    category: 'Downloaders',
    aliases: ['plays', 'music', 'song'],
    description: 'Search and download a song as MP3 (direct, safer)',
    filename: __filename
}, async (sock, m, args) => {
    const query = args.join(' ').trim();
    if (!query) return m.reply('*Which song do you want to play?*\nUsage: .play <song name>');

    let outPath = null;
    try {
        await m.reply('🔍 *Searching...*');

        const { videos } = await yts(query);
        if (!videos?.length) return m.reply('❌ *No results found!*');

        const video = videos[0];
        await m.reply(`✅ *Found:* ${video.title}\n⏱️ ${video.timestamp}\n👤 ${video.author.name}\n\n⏳ *Downloading & converting (may take a moment)...*`);

        if (!ytdl.validateURL(video.url)) {
            return m.reply('❌ *Invalid video URL. Try another result.*');
        }

        // Prepare temporary file
        outPath = tmpFilePath('popkid');

        // Create ytdl stream
        const ytdlStream = ytdl(video.url, {
            quality: 'highestaudio',
            filter: 'audioonly',
            highWaterMark: 1 << 25
        });

        // Convert to mp3 file using ffmpeg
        await ffmpegConvertToFile(ytdlStream, outPath);

        // Check file exists and size
        const stat = fs.statSync(outPath);
        if (!stat || !stat.size) throw new Error('Converted file missing');

        if (stat.size > MAX_BYTES) {
            fs.unlinkSync(outPath);
            outPath = null;
            return m.reply('❌ *The converted file is too large to send (exceeds 15MB). Try a shorter song or a different track.*');
        }

        const baseName = sanitizeFilename(video.title || 'song');
        const fileName = `${baseName}.mp3`;

        // Attempt to send as audio (preferred). If it fails, fall back to sending as document.
        try {
            await sock.sendMessage(m.from, {
                audio: fs.createReadStream(outPath),
                mimetype: 'audio/mpeg',
                fileName
            }, { quoted: m });
        } catch (sendErr) {
            console.warn('play: sending as audio failed, trying as document:', sendErr?.message || sendErr);
            try {
                await sock.sendMessage(m.from, {
                    document: fs.createReadStream(outPath),
                    mimetype: 'audio/mpeg',
                    fileName
                }, { quoted: m });
            } catch (docErr) {
                console.error('play: send fallback failed:', docErr);
                return m.reply('❌ *Downloaded the audio but failed to send it. Try again.*');
            }
        }

    } catch (err) {
        console.error('play: error:', err);
        const reason = err && err.message ? err.message : String(err);
        try { await m.reply(`❌ *Failed:* ${reason}`); } catch (e) { /* ignore */ }
    } finally {
        // cleanup temp file
        try { if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (e) { /* ignore */ }
    }
});
