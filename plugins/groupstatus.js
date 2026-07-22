const { prepareWAMessageMedia, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'groupstatus',
    category: 'Status',
    description: 'Send group status silently',
    aliases: ['gstatus'],
    tags: ['group'],
    command: /^\.?(groupstatus|gstatus)$/i,

    async execute(sock, m, args) {
        try {
            const normalize = jid => jid?.split(':')[0];

            const sender = normalize(m.sender);
            const botId = normalize(sock.user.id);
            const owners = (global.owners || []).map(normalize);

            const isOwner = owners.includes(sender) || sender === botId;

            if (!isOwner) return;

            const COLORS = {
                green: 0xFF25D366,
                red: 0xFFFF0000,
                blue: 0xFF0000FF,
                yellow: 0xFFFFFF00,
                purple: 0xFF800080,
                black: 0xFF000000,
                white: 0xFFFFFFFF,
                orange: 0xFFFFA500
            };

            let groupId;
            let messageText;
            let chosenColor = COLORS.green;
            let quoted = m.quoted;

            if (!m.isGroup) {
                if (quoted) {
                    if (args.length < 1) {
                        await sock.sendMessage(m.from, { 
                            text: 'Please provide the group JID.\nUsage: .gstatus groupjid\nExample: .gstatus 123456789-123456@g.us' 
                        });
                        return;
                    }
                    groupId = args[0];
                } else {
                    if (args.length < 1) {
                        await sock.sendMessage(m.from, { 
                            text: 'Invalid format.\nUsage: .gstatus groupjid,text,color\nExample: .gstatus 123456789-123456@g.us,Hello group!,blue' 
                        });
                        return;
                    }

                    const fullText = args.join(' ');
                    const parts = fullText.split(',').map(part => part.trim());
                    
                    if (parts.length < 2) {
                        await sock.sendMessage(m.from, { 
                            text: 'Please provide at least group JID and text separated by commas' 
                        });
                        return;
                    }

                    groupId = parts[0];
                    messageText = parts[1];

                    if (parts.length >= 3) {
                        const possibleColor = parts[2].toLowerCase();
                        if (COLORS[possibleColor]) {
                            chosenColor = COLORS[possibleColor];
                        }
                    }
                }
            } else {
                groupId = m.from;
                quoted = m.quoted;
            }

            let innerMessage;

            if (quoted) {
                if (quoted.message?.imageMessage) {
                    const buffer = await quoted.download();

                    const media = await prepareWAMessageMedia(
                        {
                            image: buffer,
                            caption: quoted.message.imageMessage.caption || ''
                        },
                        { upload: sock.waUploadToServer }
                    );

                    innerMessage = { imageMessage: media.imageMessage };
                } else if (quoted.message?.videoMessage) {
                    const buffer = await quoted.download();

                    const media = await prepareWAMessageMedia(
                        {
                            video: buffer,
                            caption: quoted.message.videoMessage.caption || ''
                        },
                        { upload: sock.waUploadToServer }
                    );

                    innerMessage = { videoMessage: media.videoMessage };
                } else if (quoted.message?.audioMessage) {
                    const buffer = await quoted.download();

                    const media = await prepareWAMessageMedia(
                        {
                            audio: buffer,
                            mimetype: quoted.message.audioMessage.mimetype || 'audio/mp4',
                            ptt: quoted.message.audioMessage.ptt || false
                        },
                        { upload: sock.waUploadToServer }
                    );

                    innerMessage = { audioMessage: media.audioMessage };
                } else {
                    if (!m.isGroup) {
                        await sock.sendMessage(m.from, { 
                            text: 'Unsupported quoted message type. Please quote an image, video, or audio message.' 
                        });
                    }
                    return;
                }
            } else {
                if (!messageText) {
                    if (!m.isGroup) {
                        await sock.sendMessage(m.from, { 
                            text: 'No message text provided.' 
                        });
                    }
                    return;
                }

                innerMessage = {
                    extendedTextMessage: {
                        text: messageText,
                        backgroundArgb: chosenColor,
                        font: 1
                    }
                };
            }

            const content = {
                groupStatusMessageV2: {
                    message: innerMessage
                }
            };

            const msg = generateWAMessageFromContent(
                groupId,
                proto.Message.fromObject(content),
                { userJid: sock.user.id }
            );

            await sock.relayMessage(
                groupId,
                msg.message,
                { messageId: msg.key.id }
            );

            if (!m.isGroup) {
                await sock.sendMessage(m.from, { 
                    text: 'Group status sent successfully.' 
                });
            }

        } catch (err) {
            console.error('GroupStatus Error:', err);
            if (!m.isGroup) {
                await sock.sendMessage(m.from, { 
                    text: 'Error sending group status: ' + err.message 
                }).catch(() => {});
            }
        }
    }
};
