import fs from "fs";
let intC = fs.readFileSync("src/events/interactionCreate.js", "utf8");

intC = intC.replace(
    /else if \(customId === 'am_select_invite_channel'\) \{\s*db\.updateGuildConfig\(guild\.id, \{ inviteAllowedChannel: interaction\.values\[0\] \}\);\s*updated = true;\s*\}/,
    `else if (customId === 'am_select_invite_channel') {
        db.updateGuildConfig(guild.id, { inviteAllowedChannel: interaction.values[0] });
        const { getChannelConfigPanel } = await import('../commands/security.js');
        return interaction.update(await getChannelConfigPanel(guild)).catch(() => null);
      }`
);

intC = intC.replace(
    /else if \(customId === 'am_select_honeypot_channel'\) \{\s*db\.updateGuildConfig\(guild\.id, \{ honeypotChannelId: interaction\.values\[0\] \}\);\s*updated = true;\s*\}/,
    `else if (customId === 'am_select_honeypot_channel') {
        db.updateGuildConfig(guild.id, { honeypotChannelId: interaction.values[0] });
        const { getChannelConfigPanel } = await import('../commands/security.js');
        return interaction.update(await getChannelConfigPanel(guild)).catch(() => null);
      }`
);

fs.writeFileSync("src/events/interactionCreate.js", intC);
