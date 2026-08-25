const { createDecipheriv } = require('crypto');
const yts = require('yt-search');
const sharp = require('sharp');
const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const { cmd } = require('../arslan');

const METADATA_DECRYPTION_KEY = Buffer.from(
  'C5D58EF67A7584E4A29F6C35BBC4EB12',
  'hex'
);

const HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'https://yt.savetube.me',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
};

// ─── Main download logic (unchanged) ───────────────────────────────

async function savetube(url, { downloadType = 'audio', quality = '128kbps' } = {}) {
  const idMatch = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/
  );

  if (!idMatch) throw 'Invalid YouTube URL';

  const videoId = idMatch[1];

  const cdnRes = await fetch('https://media.savetube.vip/api/random-cdn', {
    headers: HEADERS
  }).then(v => v.json()).catch(() => null);

  if (!cdnRes?.cdn) throw 'CDN tidak available';

  const cdn = cdnRes.cdn;

  const info = await fetch(`https://${cdn}/v2/info`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      url: 'https://www.youtube.com/watch?v=' + videoId
    })
  }).then(v => v.json()).catch(() => null);

  if (!info?.data) throw 'Metadata empty';

  let metadata;

  try {
    const encrypted = Buffer.from(info.data, 'base64');

    const decipher = createDecipheriv(
      'aes-128-cbc',
      METADATA_DECRYPTION_KEY,
      encrypted.subarray(0, 16)
    );

    const decrypted = Buffer.concat([
      decipher.update(encrypted.subarray(16)),
      decipher.final()
    ]);

    metadata = JSON.parse(decrypted.toString('utf8'));
  } catch {
    throw 'Decrypt metadata failed';
  }

  if (!metadata?.key) throw 'Key download not found';

  const dl = await fetch(`https://${cdn}/download`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      id: videoId,
      downloadType,
      quality,
      key: metadata.key
    })
  }).then(v => v.json()).catch(() => null);

  if (!dl?.data?.downloadUrl)
    throw dl?.message || 'Download failed';

  return {
    title: metadata.title,
    duration: metadata.durationLabel,
    thumbnail: metadata.thumbnail,
    url: dl.data.downloadUrl
  };
}

async function savetubeRetry(url, opts, retry = 3) {
  let lastErr;

  for (let i = 0; i < retry; i++) {
    try {
      return await savetube(url, opts);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr;
}

async function getThumb(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch thumbnail');

    const raw = Buffer.from(await res.arrayBuffer());

    return await sharp(raw)
      .resize(1280, 720, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 90
      })
      .toBuffer();
  } catch (e) {
    console.error('Thumb Error:', e);
    return Buffer.alloc(0);
  }
}

async function createHighQualityThumbnail(sock, thumb) {
  try {
    if (!thumb?.length) return null;

    const { imageMessage } = await prepareWAMessageMedia(
      {
        image: thumb
      },
      {
        upload: sock.waUploadToServer,
        mediaTypeOverride: 'thumbnail-link'
      }
    );

    imageMessage.width = 1280;
    imageMessage.height = 720;

    return imageMessage;
  } catch (e) {
    console.error('HQ Thumb Error:', e);
    return null;
  }
}

// ─── Plugin wrapper (converted to arslan cmd() style) ──────────────

cmd({
    pattern: "play",
    name: 'play',
    category: 'downloader',
    aliases: [],
    description: 'Search and play/download a song from YouTube',
    filename: __filename
}, async (sock, m, args) => {

    const text = args.join(' ');
    const usedPrefix = m.prefix || '.';
    const command = 'play';

    if (!text)
        throw `Example:\n${usedPrefix + command} chase atlantic`;

    await m.react('🎧');

    let url = text;

    if (!/youtube\.com|youtu\.be/i.test(text)) {
        const search = await yts(text);

        if (!search?.videos?.length)
            throw 'Song not found';

        url = search.videos[0].url;
    }

    const detail = await yts(url);
    const vid = detail?.videos?.[0];

    if (!vid)
        throw 'Video not found';

    const ytUrl = vid.url || url;
    const thumb = await getThumb(vid.thumbnail);
    const highQualityThumbnail = await createHighQualityThumbnail(sock, thumb);

    const invisible = '\u200B'.repeat(400);

    const caption = `
┈─ ◦ now playing ◦ ─┈

🎵 ${vid.title}

⏱️ ${vid.timestamp || '-'}
👁️ ${Number(vid.views || 0).toLocaleString('id-ID')}
📆 ${vid.ago || '-'}

⏳ currently mengambil audio...
`.trim();

    await sock.sendMessage(
        m.from,
        {
            text: `${ytUrl}${invisible}

${caption}`,

            linkPreview: {
                'matched-text': ytUrl,
                matchedText: ytUrl,
                canonicalUrl: ytUrl,
                title: vid.title,
                description: `🎧 ɪᴍᴍᴜ ᴍᴅ ᴠ𝟹 • ${vid.timestamp || 'Audio'}`,
                previewType: 0,
                jpegThumbnail: thumb,
                highQualityThumbnail,
                thumbnailUrl: vid.thumbnail,
                linkPreviewMetadata: {
                    linkMediaDuration: 0,
                    socialMediaPostType: 4
                }
            },

            favicon: {
                url: vid.thumbnail
            }
        },
        {
            quoted: global.fmeta || m
        }
    );

    try {
        const audio = await savetubeRetry(url, {
            downloadType: 'audio',
            quality: '128kbps'
        });

        await sock.sendMessage(
            m.from,
            {
                audio: {
                    url: audio.url
                },
                mimetype: 'audio/mpeg',
                fileName: `${audio.title}.mp3`,
                ptt: false
            },
            {
                quoted: global.fmeta || m
            }
        );

        await m.react('✅');
    } catch (e) {
        console.error(e);

        await m.react('❌');

        await sock.sendMessage(
            m.from,
            {
                text: '❌ Audio failed diambil, coba lagi nanti.'
            },
            {
                quoted: global.fmeta || m
            }
        );
    }
});
