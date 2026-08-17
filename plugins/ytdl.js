const yts = require('yt-search');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const stream = require('stream');
const { promisify } = require('util');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const { cmd } = require('../arslan');

const pipeline = promisify(stream.pipeline);

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB upload guard (adjust to your limits)
const DOWNLOAD_TIMEOUT = 2 * 60 * 1000; // 2 minutes

function sanitizeFilename(name) {
    return name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g,' ').trim().slice(0, 140);
}

async function streamToBuffer(readable, maxBytes, timeoutMs) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let length = 0;
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            readable.destroy(new Error('Timeout while downloading/transcoding'));
            reject(new Error('Download/transcode timeout'));
        }, timeoutMs);

        readable.on('data', chunk => {
            length += chunk.length;
            if (length > maxBytes) {
                clearTimeout(timeout);
                readable.destroy(new Error('File too large'));
                return reject(new Error('File exceeds size limit'));
            }
            chunks.push(chunk);
        });
        readable.on('end', () => {
            if (timedOut) return;
            clearTimeout(timeout);
            resolve(Buffer.concat(chunks));
        });
        readable.on('error', (err) => {
            if (timedOut) return;
            clearTimeout(timeout);
            reject(err);
        });
    });
}

cmd({
    pattern: "play",
    name: 'play',
    category: 'Downloaders',
    aliases: ['plays', 'music', 'song'],
    description: 'Search and download a song as MP3 from YouTube (direct)',
    filename: __filename
}, async (sock, m, args) => {
    const query = args.join(' ').trim();
    if (!query) return m.reply('*Which song do you want to play?*\nUsage: .play <song name>');

    try {
        await m.reply('🔍 *Searching...*');

        const { videos } = await yts(query);
        if (!videos?.length) return m.reply('❌ *No results found!*');

        const video = videos[0];
        await m.reply(`✅ *Found:* ${video.title}\n⏱️ ${video.timestamp}\n👤 ${video.author.name}\n\n⏳ *Downloading & converting (may take a moment)...*`);

        // Validate and prepare ytdl
        if (!ytdl.validateURL(video.url)) {
            return m.reply('❌ *Invalid video URL. Try another result.*');
        }

        // Create ytdl stream (audio only)
        const ytdlStream = ytdl(video.url, {
            quality: 'highestaudio',
            filter: 'audioonly',
            highWaterMark: 1 << 25 // increase buffer for large streams
        });

        // Pipe through ffmpeg to convert to mp3
        const ffmpegStream = new stream.PassThrough();
        const ffmpegProcess = ffmpeg(ytdlStream)
            .noVideo()
            .format('mp3')
            .audioBitrate(128)
            .on('error', err => {
                ytdlStream.destroy();
                ffmpegStream.destroy(err);
            })
            .pipe(ffmpegStream, { end: true });

        // Stream to buffer with guards
        let buffer;
        try {
            buffer = await streamToBuffer(ffmpegStream, MAX_BYTES, DOWNLOAD_TIMEOUT);
        } catch (err) {
            console.error('play: buffer error:', err);
            if (err.message === 'File exceeds size limit') {
                return m.reply('❌ *The converted file is too large to send. Try a shorter song or use .play with a different track.*');
            }
            return m.reply('❌ *Failed to download/convert the audio. Try again later.*');
        }

        // Sanitize filename
        const baseName = sanitizeFilename(video.title || 'song');
        const fileName = `${baseName}.mp3`;

        // Attempt to send as audio; if it fails, fallback to document
        try {
            await sock.sendMessage(m.from, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                fileName
            }, { quoted: m });
        } catch (sendErr) {
            console.warn('play: sending as audio failed, trying as document:', sendErr?.message || sendErr);
            try {
                await sock.sendMessage(m.from, {
                    document: buffer,
                    mimetype: 'audio/mpeg',
                    fileName
                }, { quoted: m });
            } catch (docErr) {
                console.error('play: send fallback failed:', docErr);
                return m.reply('❌ *Downloaded the audio but failed to send it. Try again later.*');
            }
        }

    } catch (err) {
        console.error('play: unexpected error:', err);
        const message = (err && err.message) ? err.message : 'Unknown error';
        return m.reply(`❌ *Failed:* ${message}`);
    }
});
