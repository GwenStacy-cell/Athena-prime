const fs = require('fs');
let js = fs.readFileSync('src/events/messageCreate.js', 'utf8');

const oldStr =     // Ignore bots and webhooks
    if (message.author.bot || message.webhookId) return;;

const newStr =     // --- UNAUTHORIZED NUKE BOT SPAM AUTO-DELETE ---
    if (message.guild && message.author.bot && message.author.id !== message.client.user.id) {
        try {
            const config = db.getGuildConfig(message.guild.id);
            if (config && (config.securityEnabled || config.antiNukeEnabled)) {
                const mods = config.antinukeModules || {};
                if (mods.antiBotAdd !== false) {
                    if (!isBotAuthorized(message.guild, message.author.id)) {
                        await message.delete().catch(() => null);
                        
                        // Prevent log spam by tracking
                        if (!message.client.nukeSpamLogs) message.client.nukeSpamLogs = new Set();
                        if (!message.client.nukeSpamLogs.has(message.author.id)) {
                            message.client.nukeSpamLogs.add(message.author.id);
                            setTimeout(() => message.client.nukeSpamLogs.delete(message.author.id), 60000);
                            
                            const embed = cv2.warn(
                                'ATHENA FIREWALL — UNAUTHORIZED SPAM BLOCKED',
                                'An unauthorized bot <@' + message.author.id + '> attempted to spam the server. Athena intercepted and instantly deleted the message.',
                                [
                                    { name: 'Channel', value: '<#' + message.channel.id + '>', inline: true },
                                    { name: 'Status', value: '**Message Deleted**', inline: true }
                                ],
                                'shield'
                            );
                            logToSecurityChannel(message.guild, embed).catch(()=>{});
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Nuke bot spam auto-delete error:', e);
        }
    }

    // Ignore bots and webhooks
    if (message.author.bot || message.webhookId) return;;

js = js.replace(oldStr, newStr);
fs.writeFileSync('src/events/messageCreate.js', js);
console.log('Injected safely!');
