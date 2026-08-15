const { cmd } = require('../arslan');

cmd({
    pattern: "popkid",
    name: "popkid",
    category: "General",
    aliases: ["pk"],
    description: "PopKid information",
    filename: __filename
}, async (sock, m, args) => {

    const message = `👑 *POPKID MD*

🤖 Your powerful WhatsApp assistant.

⚡ Fast • Stable • Powerful
🛠️ Built by *POPKID*

💻 Type *.menu* to explore my commands.`;

    await m.reply(message);
});
