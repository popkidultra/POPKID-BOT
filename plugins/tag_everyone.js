module.exports = {
    name: 'all',
    category: 'Group',
    aliases: ['everyone1'],
    description: 'Tag everyone in the group',

    async execute(sock, m, args = []) {

        if (!m.isGroup) {
            return await sock.sendMessage(m.from, {
                text: 'This command can only be used in groups!'
            });
        }

        const normalize = jid => jid?.split(':')[0];
        const sender = normalize(m.sender);
        const botId = normalize(sock.user.id);
        const owners = (global.owners || []).map(normalize);

        const isOwner =
            owners.includes(sender) ||
            sender === botId;

        if (!isOwner) {
            const groupMetadata = await sock.groupMetadata(m.from);

            const adminIds = groupMetadata.participants
                .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                .map(p => normalize(p.id));

            if (!adminIds.includes(sender)) {
                return await sock.sendMessage(m.from, {
                    text: 'Only group admins or owners can use this command!'
                });
            }
        }

        const jid = m.from;
        const groupMetadata = await sock.groupMetadata(jid);
        const subject = args.length ? args.join(' ') : 'everyone';

        await sock.sendMessage(jid, {
            text: '@' + jid,
            contextInfo: {
                mentionedJid: groupMetadata.participants.map(x => x.id),
                groupMentions: [
                    {
                        groupJid: jid,
                        groupSubject: subject
                    }
                ]
            }
        });
    }
};
