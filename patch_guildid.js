import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");
js = js.replace(/const config = db\.getGuildConfig\(guildId\);\s*const current = config\.selfbotDetectionEnabled !== false;\s*db\.updateGuildConfig\(guildId, \{ selfbotDetectionEnabled: !current \}\);/g, 
`const current = config.selfbotDetectionEnabled !== false;
        db.updateGuildConfig(guild.id, { selfbotDetectionEnabled: !current });`);
fs.writeFileSync("src/events/interactionCreate.js", js);
