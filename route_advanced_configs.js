import fs from "fs";
let intC = fs.readFileSync("src/events/interactionCreate.js", "utf8");

intC = intC.replace(
    /else if \(customId === 'am_channel_configs'\) \{\s*const \{ getChannelConfigPanel \} = await import\('\.\.\/commands\/security\.js'\);\s*const newPanel = await getChannelConfigPanel\(guild\);\s*return interaction\.update\(newPanel\)\.catch\(\(\) => null\);\s*\}/g,
    `else if (customId === 'am_advanced_configs') {
        const { getAdvancedConfigPanel } = await import('../commands/security.js');
        const newPanel = await getAdvancedConfigPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }`
);

intC = intC.replace(
    /else if \(customId === 'am_tgl_global_links'\) \{\s*const newVal = !config\.allowAllLinks;\s*const updateData = \{ allowAllLinks: newVal \};\s*if \(newVal\) updateData\.antiLinkEnabled = false;\s*db\.updateGuildConfig\(guild\.id, updateData\);\s*updated = true;\s*\}/,
    `else if (customId === 'am_tgl_global_links') {
        const newVal = !config.allowAllLinks;
        const updateData = { allowAllLinks: newVal };
        if (newVal) updateData.antiLinkEnabled = false;
        db.updateGuildConfig(guild.id, updateData);
        const { getAdvancedConfigPanel } = await import('../commands/security.js');
        const newPanel = await getAdvancedConfigPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }`
);

intC = intC.replace(
    /else if \(customId === 'am_tgl_global_invites'\) \{\s*const config = db\.getGuildConfig\(guildId\);\s*const newVal = !config\.allowInvitesGlobally;\s*const updateData = \{ allowInvitesGlobally: newVal \};\s*if \(newVal\) updateData\.antiInviteEnabled = false;\s*db\.updateGuildConfig\(guild\.id, updateData\);\s*const \{ getAutoModPanel \} = await import\('\.\.\/commands\/security\.js'\);\s*const newPanel = await getAutoModPanel\(guild\);\s*return interaction\.update\(newPanel\)\.catch\(\(\) => null\);\s*\}/,
    `else if (customId === 'am_tgl_global_invites') {
        const config = db.getGuildConfig(guildId);
        const newVal = !config.allowInvitesGlobally;
        const updateData = { allowInvitesGlobally: newVal };
        if (newVal) updateData.antiInviteEnabled = false;
        db.updateGuildConfig(guild.id, updateData);
        const { getAdvancedConfigPanel } = await import('../commands/security.js');
        const newPanel = await getAdvancedConfigPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }`
);

// We must also revert the channel selects routing back to the main menu
intC = intC.replace(
    /else if \(customId === 'am_select_invite_channel'\) \{\s*db\.updateGuildConfig\(guild\.id, \{ inviteAllowedChannel: interaction\.values\[0\] \}\);\s*const \{ getChannelConfigPanel \} = await import\('\.\.\/commands\/security\.js'\);\s*return interaction\.update\(await getChannelConfigPanel\(guild\)\)\.catch\(\(\) => null\);\s*\}/,
    `else if (customId === 'am_select_invite_channel') {
        db.updateGuildConfig(guild.id, { inviteAllowedChannel: interaction.values[0] });
        updated = true;
      }`
);

intC = intC.replace(
    /else if \(customId === 'am_select_honeypot_channel'\) \{\s*db\.updateGuildConfig\(guild\.id, \{ honeypotChannelId: interaction\.values\[0\] \}\);\s*const \{ getChannelConfigPanel \} = await import\('\.\.\/commands\/security\.js'\);\s*return interaction\.update\(await getChannelConfigPanel\(guild\)\)\.catch\(\(\) => null\);\s*\}/,
    `else if (customId === 'am_select_honeypot_channel') {
        db.updateGuildConfig(guild.id, { honeypotChannelId: interaction.values[0] });
        updated = true;
      }`
);

fs.writeFileSync("src/events/interactionCreate.js", intC);
console.log("Replaced intC successfully");
