const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const { tmpdir } = require("os");

function convertToOpus(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .toFormat("opus")
      .audioCodec("libopus")
      .audioBitrate("64k")
      .on("end", resolve)
      .on("error", reject)
      .save(output);
  });
}

module.exports = {
  name: "upload-channel",
    category: 'Channel',
  description: "Upload media to WhatsApp channel",
  aliases: ["upch", "sendch"],
  tags: ["tools"],
  command: /^\.?(upch|sendch)/i,

  async execute(sock, m) {
    try {
      const quoted = m.quoted || m;

      if (!quoted) {
        return m.reply("Reply to a media message.");
      }

      const chJid = global.idch;
      if (!chJid) return m.reply("Channel ID not configured.");

      const type = quoted.mtype;
      const buffer = await quoted.download();

      if (!buffer) {
        return m.reply("Failed to download media.");
      }

      await m.reply("Processing media...");

      if (type === "imageMessage") {
        await sock.sendMessage(chJid, {
          image: buffer,
          caption: quoted.text || ""
        });
      }

      else if (type === "videoMessage") {
        await sock.sendMessage(chJid, {
          video: buffer,
          caption: quoted.text || ""
        });
      }

      else if (type === "ptvMessage") {
        await sock.sendMessage(chJid, {
          video: buffer,
          mimetype: "video/mp4",
          ptv: true
        });
      }

      else if (type === "stickerMessage") {
        await sock.sendMessage(chJid, {
          sticker: buffer
        });
      }

      else if (type === "audioMessage") {
        const base = `${Date.now()}`;
        const input = path.join(tmpdir(), `${base}.ogg`);
        const output = path.join(tmpdir(), `${base}.opus`);

        fs.writeFileSync(input, buffer);
        await convertToOpus(input, output);

        const opusBuffer = fs.readFileSync(output);

        await sock.sendMessage(chJid, {
          audio: opusBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        });

        fs.unlinkSync(input);
        fs.unlinkSync(output);
      }

      else {
        return m.reply("Unsupported media.");
      }

      await m.reply("Media uploaded to channel.");

    } catch (err) {
      console.error("Upload Channel Error:", err);
      m.reply("Failed to upload media.");
    }
  }
};
