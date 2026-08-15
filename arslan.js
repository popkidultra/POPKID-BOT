/**
 * Popkid command framework
 *
 * Plugins register themselves with:
 *
 *   const { cmd } = require('../arslan');
 *
 *   cmd({
 *       pattern: "ping",
 *       alias: ["pong"],
 *       desc: "Check bot response speed",
 *       category: "info",
 *       react: "🏓",
 *       filename: __filename
 *   }, async (sock, m, args) => {
 *       // command body
 *   });
 *
 * Every command lands in two places automatically so nothing else in the
 * bot (the menu, the dispatcher, group-only checks, etc.) has to change:
 *
 *   - global.commands  -> flat array of every registered command, used by
 *                         the fast pattern/alias lookup in index.js.
 *   - global.plugins    -> the same name/execute Map the bot already used,
 *                         kept in sync so plugins/main-menu.js and friends
 *                         keep working exactly as before.
 */

global.commands = global.commands || [];
global.plugins = global.plugins instanceof Map ? global.plugins : new Map();

function toArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}

function cmd(info = {}, handler) {
    const pattern = String(info.pattern || info.name || '').toLowerCase();

    const aliasList = [
        ...toArray(info.alias),
        ...toArray(info.aliases)
    ].map(a => String(a).toLowerCase());

    const entry = Object.assign({}, info, {
        pattern,
        alias: aliasList,
        category: info.category || 'General',
        desc: info.desc || info.description || '',
        react: info.react || '',
        function: handler
    });

    global.commands.push(entry);

    // Keep the classic { name, aliases, category, description, hidden, execute }
    // plugin shape in sync automatically for backward compatibility.
    const legacyPlugin = {
        name: entry.pattern,
        aliases: entry.alias,
        category: entry.category,
        description: entry.desc,
        hidden: !!info.hidden,
        cmdEntry: entry,
        async execute(sock, m, args) {
            return entry.function(sock, m, args);
        }
    };

    entry.legacyPlugin = legacyPlugin;

    global.plugins.set(entry.pattern, legacyPlugin);
    aliasList.forEach(alias => global.plugins.set(alias, legacyPlugin));

    return legacyPlugin;
}

module.exports = { cmd, commands: global.commands };
