module.exports = {
    name: 'save',
    category: 'Admin',
    aliases: ['savefile', 'download'],
    description: 'Save media from quoted message (Owner only)',
    
    async execute(sock, m, args) {
        const normalize = jid => jid?.split(':')[0];
        const sender = normalize(m.sender);
        const botId = normalize(sock.user.id);
        const owners = (global.owners || []).map(normalize);
        
        const isOwner = owners.includes(sender) || sender === botId;
        
        if (!isOwner) {
            return await sock.sendMessage(m.from, {
                text: 'This command can only be used by the bot owner!'
            });
        }
        
        if (!m.quoted) {
            return m.reply(`SAVE MEDIA COMMAND\n\nUsage: .save (reply to a media message)\n\nYou can save:\nImages\nVideos\nAudio\nDocuments\nView once media`);
        }
        
        try {
            let msg = m.quoted.message;
            
            while (true) {
                if (msg?.groupStatusMessageV2) {
                    msg = msg.groupStatusMessageV2.message;
                } else if (msg?.ephemeralMessage) {
                    msg = msg.ephemeralMessage.message;
                } else if (msg?.viewOnceMessage) {
                    msg = msg.viewOnceMessage.message;
                } else if (msg?.message) {
                    msg = msg.message;
                } else {
                    break;
                }
            }
            
            const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
            let mediaType = null;
            
            for (const type of mediaTypes) {
                if (msg[type]) {
                    mediaType = type;
                    break;
                }
            }
            
            if (!mediaType) {
                return m.reply('No media found in the quoted message');
            }
            
            await m.reply(`Downloading media...`);
            
            const buffer = await downloadMediaMessage(
                { message: msg },
                'buffer',
                {},
                { logger: console }
            );
            
            const mediaData = msg[mediaType];
            const mimetype = mediaData.mimetype || '';
            const caption = mediaData.caption || `Saved on ${new Date().toLocaleString()}`;
            
            if (mediaType === 'imageMessage') {
                await sock.sendMessage(m.sender, {
                    image: buffer,
                    caption: `Image saved\n\n${caption}`
                });
            } 
            else if (mediaType === 'videoMessage') {
                await sock.sendMessage(m.sender, {
                    video: buffer,
                    caption: `Video saved\n\n${caption}`,
                    mimetype: mimetype
                });
            }
            else if (mediaType === 'audioMessage') {
                await sock.sendMessage(m.sender, {
                    audio: buffer,
                    mimetype: mimetype,
                    ptt: mediaData.ptt || false
                });
            }
            else if (mediaType === 'documentMessage') {
                await sock.sendMessage(m.sender, {
                    document: buffer,
                    mimetype: mimetype,
                    fileName: mediaData.fileName || 'document'
                });
            }
            else if (mediaType === 'stickerMessage') {
                await sock.sendMessage(m.sender, {
                    sticker: buffer
                });
            }
            
            await m.reply(`Media saved successfully!\nCheck your private chat`);
            
        } catch (err) {
            console.error('save command error:', err);
            await m.reply(`Failed to save media\n\n${err.message}`);
        }
    }
};
