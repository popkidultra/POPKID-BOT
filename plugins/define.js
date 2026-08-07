const axios = require('axios');

module.exports = {
    cmd: "define",
    alias: ["dict", "urban", "meaning"],
    desc: "Search a word on Urban Dictionary",
    category: "search",
    async execute(conn, m, { text }) {
        const query = text ? text.trim() : null;

        if (!query) {
            return m.reply("✨ *Usage:* .define <word>\nExample: .define coding");
        }

        try {
            const url = `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(query)}`;
            const { data: json } = await axios.get(url);

            if (!json || !json.list || json.list.length === 0) {
                return m.reply(`❌ No definitions found for: *${query}*`);
            }

            // Get the top result
            const firstEntry = json.list[0];
            
            // Urban Dictionary uses brackets like [word] in their text; let's remove them for a cleaner look
            const cleanDef = firstEntry.definition.replace(/[\[\]]/g, '');
            const cleanEx = firstEntry.example ? firstEntry.example.replace(/[\[\]]/g, '') : 'No example provided.';

            const responseText = `🔍 *Urban Dictionary*\n\n` +
                                `📖 *Word:* ${firstEntry.word}\n\n` +
                                `📝 *Definition:* ${cleanDef}\n\n` +
                                `💡 *Example:* _${cleanEx}_ \n\n` +
                                `👍 *Votes:* ${firstEntry.thumbs_up} | 👎 ${firstEntry.thumbs_down}\n\n` +
                                `*POPKID-MD*`;

            await m.reply(responseText);

        } catch (e) {
            console.error("Define Command Error:", e);
            return m.reply("⚠️ Error fetching definition. Please try again later.");
        }
    }
};
