import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldStr = `// Ignore bots and webhooks
    if (message.author.bot || message.webhookId) return;`;

const newStr = `// --- UNAUTHORIZED NUKE BOT SPAM AUTO-DELETE ---
    if (message.guild && message.author.bot && message.author.id !== message.client.user.id) {
        try {
            const config = db.getGuildConfig(message.guild.id);
            if (config && (config.securityEnabled || config.antiNukeEnabled)) {
                const mods = config.antinukeModules || {};
                if (mods.antiBotAdd !== false) {
                    const { isBotAuthorized } = await import('../utils/antinuke.js');
                    if (!isBotAuthorized(message.guild, message.author.id)) {
                        // Silently delete every single message this unauthorized bot sends
                        // This auto-repairs spam damage even if Athena's role is too low to ban it
                        await message.delete().catch(() => null);
                    }
                }
            }
        } catch (e) {
            console.error('Nuke bot spam auto-delete error:', e);
        }
    }

    // Ignore bots and webhooks
    if (message.author.bot || message.webhookId) return;`;

js = js.replace(oldStr, newStr);
fs.writeFileSync("src/events/messageCreate.js", js);
console.log("Injected unauthorized bot auto-delete!");
