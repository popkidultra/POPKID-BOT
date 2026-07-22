'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const chalk = require('chalk');
const logger = require('./logger');

/**
 * sessionLoader — Restores creds.json from a self-contained base64 SESSION_ID.
 *
 * Format: SESSION_ID = "<PREFIX>~<base64(payload)>"   (or "PREFIX___payload" for legacy NEXUS)
 * The prefix is cosmetic/branding only and is stripped before decoding.
 * Recognized prefixes (stripped, case-sensitive):
 *   "POPKID~"      -> base64(zip archive containing creds.json)   [current]
 *   "F~"           -> base64(gzip(creds.json))                    [legacy]
 *   "SILA-MD~"     -> base64(gzip(creds.json))                    [legacy]
 *   "NEXUS___"     -> base64(gzip(creds.json))                    [legacy]
 *
 * The payload format is auto-detected from its magic bytes after base64
 * decoding, so any of the above prefixes will work regardless of whether
 * the underlying payload is a zip archive or a raw gzip stream.
 *
 * No external network call and no third-party zip library is needed — the
 * zip parsing below only handles the single-entry, non-streamed case that
 * these session-string generators produce (standard local file header with
 * sizes populated inline, method STORE or DEFLATE).
 */

const KNOWN_PREFIXES = ['POPKID~', 'F~', 'SILA-MD~', 'NEXUS___'];

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"
const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);
const LOCAL_HEADER_SIZE = 30;

/**
 * Strips any recognized branding prefix from the raw SESSION_ID.
 */
function stripPrefix(raw) {
    let value = raw.trim();
    for (const prefix of KNOWN_PREFIXES) {
        if (value.startsWith(prefix)) {
            value = value.slice(prefix.length);
            break;
        }
    }
    return value.trim();
}

/**
 * Extracts a named entry from a zip archive buffer by walking its local
 * file headers. Supports STORE (0) and DEFLATE (8) compression methods,
 * which covers every common session-string generator in the wild.
 */
function extractFromZip(buffer, targetName = 'creds.json') {
    let offset = 0;

    while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
        const flags = buffer.readUInt16LE(offset + 6);
        const method = buffer.readUInt16LE(offset + 8);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const uncompressedSize = buffer.readUInt32LE(offset + 22);
        const nameLength = buffer.readUInt16LE(offset + 26);
        const extraLength = buffer.readUInt16LE(offset + 28);

        const hasDataDescriptor = (flags & 0x0008) !== 0;
        if (hasDataDescriptor) {
            throw new Error('zip entry uses a streamed data descriptor, which is not supported');
        }

        const nameStart = offset + LOCAL_HEADER_SIZE;
        const name = buffer.toString('utf8', nameStart, nameStart + nameLength);
        const dataStart = nameStart + nameLength + extraLength;
        const dataEnd = dataStart + compressedSize;

        if (dataEnd > buffer.length) {
            throw new Error('zip entry data runs past end of buffer (truncated session string?)');
        }

        if (name === targetName) {
            const compData = buffer.subarray(dataStart, dataEnd);
            if (method === 0) return compData;
            if (method === 8) {
                const inflated = zlib.inflateRawSync(compData);
                if (inflated.length !== uncompressedSize) {
                    throw new Error('inflated size mismatch — data may be corrupt');
                }
                return inflated;
            }
            throw new Error(`unsupported zip compression method (${method})`);
        }

        offset = dataEnd;
    }

    throw new Error(`zip archive does not contain a "${targetName}" entry`);
}

/**
 * Normalizes a base64 string into the standard alphabet:
 *  - strips whitespace/newlines/zero-width characters that chat apps sometimes inject
 *  - accepts the standard alphabet (+ /), the URL-safe alphabet (- _), AND the
 *    CYPHER-X pairing site's variant, which substitutes '*' for '/'
 *  - restores '=' padding if it was stripped
 */
function normalizeBase64(str) {
    let value = str.replace(/[\s\u200B-\u200D\uFEFF]/g, ''); // strip whitespace + zero-width chars
    value = value.replace(/-/g, '+').replace(/_/g, '/'); // url-safe -> standard alphabet
    value = value.replace(/\*/g, '/'); // CYPHER-X pairing site alphabet -> standard alphabet
    const remainder = value.length % 4;
    if (remainder === 2) value += '==';
    else if (remainder === 3) value += '=';
    else if (remainder === 1) throw new Error('base64 length is invalid (string is truncated or corrupted)');
    return value;
}

/**
 * Decodes a base64 SESSION_ID (zip or gzip payload) into a raw creds.json buffer.
 * Returns { ok: true, data } or { ok: false, reason }.
 */
function decodeSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
        return { ok: false, reason: 'SESSION_ID is empty' };
    }

    const sessdata = stripPrefix(sessionId);
    if (!sessdata) {
        return { ok: false, reason: 'SESSION_ID is empty after stripping prefix' };
    }

    let normalized;
    try {
        normalized = normalizeBase64(sessdata);
    } catch (e) {
        return { ok: false, reason: e.message };
    }

    let payload;
    try {
        payload = Buffer.from(normalized, 'base64');
        if (!payload.length) throw new Error('decoded buffer is empty');
    } catch (e) {
        return { ok: false, reason: `invalid base64: ${e.message}` };
    }

    let credsBuffer;
    try {
        if (payload.subarray(0, 4).equals(ZIP_MAGIC)) {
            credsBuffer = extractFromZip(payload, 'creds.json');
        } else if (payload.subarray(0, 2).equals(GZIP_MAGIC)) {
            credsBuffer = zlib.gunzipSync(payload);
        } else {
            return { ok: false, reason: 'unrecognized payload format (not zip or gzip)' };
        }
    } catch (e) {
        return { ok: false, reason: `failed to unpack payload: ${e.message}` };
    }

    try {
        JSON.parse(credsBuffer.toString('utf8'));
    } catch (e) {
        return { ok: false, reason: `decoded data is not valid JSON: ${e.message}` };
    }

    return { ok: true, data: credsBuffer };
}

/**
 * Writes data to credsPath atomically: write to a temp file in the same
 * directory, then rename. This avoids ever leaving a half-written creds.json
 * behind if the process crashes mid-write.
 */
async function atomicWrite(credsPath, data) {
    const dir = path.dirname(credsPath);
    const tmpPath = path.join(dir, `.creds.${crypto.randomBytes(6).toString('hex')}.tmp`);
    await fs.promises.writeFile(tmpPath, data);
    await fs.promises.rename(tmpPath, credsPath);
}

async function loadSession(sessionId, sessionDir) {
    const credsPath = path.join(sessionDir, 'creds.json');

    if (fs.existsSync(credsPath)) {
        logger.info(chalk.green('[ ✅ ] Session already exists, skipping extraction.'));
        return true;
    }

    try {
        await fs.promises.mkdir(sessionDir, { recursive: true });
    } catch (e) {
        logger.error(chalk.red('[ ❌ ] Could not create session directory:'), e.message);
        return false;
    }

    if (!sessionId || sessionId.trim() === '') {
        logger.error(chalk.red('[ ❌ ] Please add your session to SESSION_ID in .env'));
        return false;
    }

    logger.info(chalk.cyan('[ 📥 ] Extracting session from base64 string...'));

    const result = decodeSessionId(sessionId);
    if (!result.ok) {
        logger.error(chalk.red('[ ❌ ] Failed to extract session:'), result.reason);
        logger.warn(chalk.yellow('[ ⚠️ ] Make sure you copied the FULL session string.'));
        return false;
    }

    try {
        await atomicWrite(credsPath, result.data);
        logger.info(chalk.green('[ ✅ ] Session extracted and saved successfully.'));
        logger.info(chalk.cyan(`[ 📊 ] Session size: ${result.data.length} bytes`));
        return true;
    } catch (e) {
        logger.error(chalk.red('[ ❌ ] Failed to write creds.json:'), e.message);
        return false;
    }
}

/**
 * Encodes a creds.json buffer/string into a SESSION_ID string (zip format),
 * for generating new session strings e.g. in a "get session ID" pairing
 * script. Uses STORE (uncompressed) to avoid needing a deflate encoder
 * here; decodeSessionId supports both.
 */
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function encodeSessionId(credsData, prefix = 'POPKID~') {
    const buf = Buffer.isBuffer(credsData) ? credsData : Buffer.from(credsData);
    const nameBuf = Buffer.from('creds.json', 'utf8');
    const crc = crc32(buf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // method = STORE
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(buf.length, 18); // compressed size
    localHeader.writeUInt32LE(buf.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(buf.length, 20);
    centralHeader.writeUInt32LE(buf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(0, 42);

    const eocd = Buffer.alloc(22);
    const localEntry = Buffer.concat([localHeader, nameBuf, buf]);
    const centralEntry = Buffer.concat([centralHeader, nameBuf]);

    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(centralEntry.length, 12);
    eocd.writeUInt32LE(localEntry.length, 16);
    eocd.writeUInt16LE(0, 20);

    const zipBuffer = Buffer.concat([localEntry, centralEntry, eocd]);
    return `${prefix}${zipBuffer.toString('base64url')}`;
}

module.exports = { loadSession, decodeSessionId, encodeSessionId };
