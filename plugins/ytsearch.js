const yts = require('yt-search');

module.exports = {
    name: 'ytsearch',
    category: 'Media',
    aliases: ['yts', 'playlist', 'yt'],
    description: 'Search YouTube for videos, playlists, and audio',

    async execute(sock, m, args) {
        const query = args.join(' ');

        // --- 1. Input Validation ---
        if (!query) {
            return await sock.sendMessage(m.from, { 
                text: '❌ *Please provide a search term!*\n\n*Example:* `.yts Lil Peep`' 
            }, { quoted: m });
        }

        try {
            // --- 2. Processing State ---
            const loadingMsg = await m.reply('🔍 *Searching YouTube...*');

            // --- 3. Execute Search ---
            const result = await yts(query);
            const videos = result.videos.slice(0, 10);

            if (!videos.length) {
                return await sock.sendMessage(m.from, { 
                    text: '❌ *No results found on YouTube.*',
                    edit: loadingMsg.key
                });
            }

            // --- 4. Double Line Visual Framing ---
            let card = `╔═════ *YOUTUBE SEARCH* ═════╗\n`;
            card += `║ 📌 *Query*   : ${query}\n`;
            card += `║ 📊 *Results* : ${videos.length} videos\n`;
            card += `╠═════════════════════════════╣\n\n`;

            videos.forEach((v, index) => {
                card += `╔═══ [ *${index + 1}* ] ════════════════\n`;
                card += `║ 🎵 *Title*    : ${v.title}\n`;
                card += `║ ⏱️ *Duration* : ${v.timestamp}\n`;
                card += `║ 👀 *Views*    : ${v.views.toLocaleString()}\n`;
                card += `║ 👤 *Channel*  : ${v.author.name}\n`;
                card += `║ 🔗 *Link*     : ${v.url}\n`;
                card += `╚═════════════════════════════\n\n`;
            });

            card += `╚════════ *POPKID XD* ════════╝`;

            // --- 5. Dispatch Result Card ---
            await sock.sendMessage(m.from, {
                image: { url: videos[0].image },
                caption: card
            }, { quoted: m });

            // Clean up temporary message
            await sock.sendMessage(m.from, { delete: loadingMsg.key });

        } catch (error) {
            console.error('YouTube Search Error:', error);
            await sock.sendMessage(m.from, { 
                text: '❌ *An error occurred while fetching YouTube results.*' 
            }, { quoted: m });
        }
    }
};
