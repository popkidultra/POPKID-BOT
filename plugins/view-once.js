module.exports = {
    name: 'viewonce',
    category: 'Tools',
    description: 'Download view once messages',
    aliases: ['vo', 'once'],
    tags: ['tools'],
    command: /^\.?(viewonce|vo|once)/i,

    async execute(sock, m) {
        try {
            if (!m.quoted) {
                return m.reply('Please reply to a view-once message to save it.');
            }

            const targetMsg = m.quoted;
            console.log('Quoted message types:', Object.keys(targetMsg.message || {}));

            let mediaBuffer, mimeType, fileName, mediaType;

            if (targetMsg.message?.imageMessage) {
                console.log('Downloading image...');
                mediaBuffer = await targetMsg.download();
                mimeType = targetMsg.message.imageMessage.mimetype || 'image/jpeg';
                fileName = `saved-image-${Date.now()}.jpg`;
                mediaType = 'image';
                
            } else if (targetMsg.message?.videoMessage) {
                console.log('Downloading video...');
                mediaBuffer = await targetMsg.download();
                mimeType = targetMsg.message.videoMessage.mimetype || 'video/mp4';
                fileName = `saved-video-${Date.now()}.mp4`;
                mediaType = 'video';
                
            } else if (targetMsg.message?.audioMessage) {
                console.log('Downloading audio...');
                mediaBuffer = await targetMsg.download();
                mimeType = targetMsg.message.audioMessage.mimetype || 'audio/ogg';
                fileName = `saved-audio-${Date.now()}.ogg`;
                mediaType = 'audio';
                
            } else {
                return m.reply('The replied message does not contain any downloadable media.');
            }

            console.log('Download successful, buffer size:', mediaBuffer.length);
            console.log('Media type:', mediaType);
            console.log('Mime type:', mimeType);

            if (mediaType === 'image') {
                await sock.sendMessage(m.from, {
                    image: mediaBuffer,
                    mimetype: mimeType,
                    caption: 'View Once Image Saved'
                });
            } else if (mediaType === 'video') {
                await sock.sendMessage(m.from, {
                    video: mediaBuffer,
                    mimetype: mimeType,
                    caption: 'View Once Video Saved'
                });
            } else if (mediaType === 'audio') {
                await sock.sendMessage(m.from, {
                    audio: mediaBuffer,
                    mimetype: mimeType,
                    ptt: false
                });
            }

            console.log('Media saved and sent successfully');

        } catch (err) {
            console.error('Save media error:', err);
            m.reply('Failed to download media. Please try again.');
        }
    },
};
