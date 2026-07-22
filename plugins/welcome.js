module.exports = {
    name: 'welcome',
    category: 'Group',
    aliases: ['welcome-toggle'],
    description: 'Toggle group welcome/left messages on or off',
    enabled: true,

    async execute(sock, m, args) {

        if (!m.isGroup) {
            return m.reply('❌ This command only works in groups.')
        }

        const metadata = await sock.groupMetadata(m.from)

        const sender = metadata.participants.find(p =>
            p.phoneNumber === m.sender || p.id === m.sender
        )

        const isAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin'

        if (!isAdmin) {
            return m.reply('❌ Admins only.')
        }

        if (!global.welcomeConfig) {
            global.welcomeConfig = { enabled: true }
        }

        if (!args[0]) {
            return m.reply(
                `⚡ Welcome messages: ${global.welcomeConfig.enabled ? 'ON' : 'OFF'}\nUsage: ${global.BOT_PREFIX}welcome on|off`
            )
        }

        const option = args[0].toLowerCase()

        if (option === 'on') {
            global.welcomeConfig.enabled = true
            await m.reply('✅ Welcome/Goodbye messages ENABLED.')
        } 
        
        else if (option === 'off') {
            global.welcomeConfig.enabled = false
            await m.reply('❌ Welcome/Goodbye messages DISABLED.')
        } 
        
        else {
            await m.reply('❌ Use `on` or `off`.')
        }
    }
}
