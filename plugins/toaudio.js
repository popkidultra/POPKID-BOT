const fs = require('fs')
const ffmpeg = require('@ffmpeg-installer/ffmpeg')
const { execSync } = require('child_process')

module.exports = {
    name: 'toaudio',
    category: 'Tools',
    aliases: ['tomp3', 'mp3'],

    async execute(sock, m) {

        if (!m.quoted) {
            return m.reply('ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴅᴇᴏ')
        }

        const mime =
            m.quoted.message?.videoMessage?.mimetype || ''

        if (!mime.includes('video')) {
            return m.reply('ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴅᴇᴏ')
        }

        try {

            await m.reply('ᴄᴏɴᴠᴇʀᴛɪɴɢ ᴛᴏ ᴀᴜᴅɪᴏ...')

            const input = './video.mp4'
            const output = './audio.mp3'

            const buffer =
                await m.quoted.download()

            fs.writeFileSync(input, buffer)

            execSync(
                `"${ffmpeg.path}" -y -i "${input}" "${output}"`
            )

            await sock.sendMessage(
                m.from,
                {
                    audio: fs.readFileSync(output),
                    mimetype: 'audio/mpeg'
                }
            )

            fs.unlinkSync(input)
            fs.unlinkSync(output)

        } catch (e) {

            console.log(e)

            m.reply('ғᴀɪʟᴇᴅ ᴛᴏ ᴄᴏɴᴠᴇʀᴛ ᴠɪᴅᴇᴏ')
        }
    }
}
