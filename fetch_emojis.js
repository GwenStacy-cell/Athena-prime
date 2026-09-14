const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers] });

client.on("ready", () => {
    const names = [
        "whitelist", "welcome", "voice", "verification", "utility", "tts", "triggers",
        "tracking", "tickets", "tickets~1", "stats", "security", "quarantine", "noprefix",
        "newsfeed", "music", "moderation", "messaging", "leveling", "giveaways", "filters",
        "customcmds", "config", "autoreact", "actions", "black_dot"
    ];

    let results = {};
    for (const name of names) {
        const e = client.emojis.cache.find(e => e.name === name);
        if (e) {
            results[name] = `<:${e.name}:${e.id}>`;
        } else {
            results[name] = "NOT_FOUND";
        }
    }
    
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
