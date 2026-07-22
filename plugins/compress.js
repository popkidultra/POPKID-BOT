const fs = require('fs')
const ffmpeg = require('@ffmpeg-installer/ffmpeg')
const { spawn } = require('child_process')
const { pipeline } = require('stream/promises')

module.exports = {
    name: 'compress',
    category: 'Tools',
    aliases: ['cmp', 'compressvideo'],

    async execute(sock, m) {
        if (!m.quoted) {
            return m.reply('ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴅᴇᴏ')
        }

        const mime = m.quoted.message?.videoMessage?.mimetype || ''

        if (!mime.includes('video')) {
            return m.reply('ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴅᴇᴏ')
        }

        const input = `./input_${Date.now()}.mp4`
        const output = `./compressed_${Date.now()}.mp4`
        let inputStream

        try {
            await m.reply('ᴄᴏᴍᴘʀᴇssɪɴɢ ᴠɪᴅᴇᴏ...')

            inputStream = await m.quoted.download()
            const writeStream = fs.createWriteStream(input)
            
            await pipeline(inputStream, writeStream)

                await new Promise((resolve, reject) => {
                const ffmpegProcess = spawn(ffmpeg.path, [
                    '-y',
                    '-i', input,
                    '-vcodec', 'libx264',
                    '-crf', '28',
                    '-preset', 'veryfast',
                    '-movflags', '+faststart',  
                    '-max_muxing_queue_size', '1024',  
                    output
                ], {
                    stdio: ['ignore', 'pipe', 'pipe']
                })

                let stderr = ''
                
                ffmpegProcess.stderr.on('data', (data) => {
                    stderr += data.toString()
                })

                ffmpegProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve()
                    } else {
                        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`))
                    }
                })

                ffmpegProcess.on('error', reject)
            })

            
            const stats = fs.statSync(output)
            const fileSizeMB = stats.size / (1024 * 1024)
            
            if (fileSizeMB > 100) { 
                await m.reply(`ᴄᴏᴍᴘʀᴇssᴇᴅ ᴠɪᴅᴇᴏ ɪs sᴛɪʟʟ ʟᴀʀɢᴇ (${fileSizeMB.toFixed(1)}MB). ᴛʀʏɪɴɢ ᴡɪᴛʜ ᴍᴏʀᴇ ᴄᴏᴍᴘʀᴇssɪᴏɴ...`)
                
            
                await new Promise((resolve, reject) => {
                    const ffmpegProcess = spawn(ffmpeg.path, [
                        '-y',
                        '-i', input,
                        '-vcodec', 'libx264',
                        '-crf', '35',
                        '-preset', 'faster',
                        '-vf', 'scale=1280:-2',  
                        '-maxrate', '1M',
                        '-bufsize', '2M',
                        '-movflags', '+faststart',
                        output
                    ], {
                        stdio: ['ignore', 'pipe', 'pipe']
                    })

                    ffmpegProcess.stderr.on('data', (data) => {
                        stderr += data.toString()
                    })

                    ffmpegProcess.on('close', (code) => {
                        if (code === 0) resolve()
                        else reject(new Error(`FFmpeg exited with code ${code}`))
                    })

                    ffmpegProcess.on('error', reject)
                })
            }

            const videoStream = fs.createReadStream(output)
            
            await sock.sendMessage(
                m.from,
                {
                    video: videoStream,
                    mimetype: 'video/mp4',
                    caption: 'ᴄᴏᴍᴘʀᴇssᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ'
                }
            )

        } catch (e) {
            console.log(e)
            m.reply('ғᴀɪʟᴇᴅ ᴛᴏ ᴄᴏᴍᴘʀᴇss ᴠɪᴅᴇᴏ')
        } finally {
            try {
                if (fs.existsSync(input)) fs.unlinkSync(input)
                if (fs.existsSync(output)) fs.unlinkSync(output)
            } catch (cleanupError) {
                console.log('Cleanup error:', cleanupError)
            }
        }
    }
}
