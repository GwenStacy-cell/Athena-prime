import fs from "fs";

let text = fs.readFileSync("src/events/interactionCreate.js", "utf8");

text = text.replace(
    /else if \(customId === 'al_select_spam_mention_role'\) \{\s*const roleIds = interaction\.values;\s*db\.updateGuildConfig\(guild\.id, \{ antiSpamMentionBypassRoles: roleIds \}\);\s*updated = true;\s*\}/,
    "else if (customId === 'al_select_spam_mention_role') {\n      const roleIds = interaction.values;\n      db.updateGuildConfig(guild.id, { antiSpamMentionBypassRoles: roleIds });\n      updated = true;\n    }\n    else if (customId === 'al_save') {\n      return interaction.message.delete().catch(() => null);\n    }"
);

fs.writeFileSync("src/events/interactionCreate.js", text);
