import fs from "fs";
let intC = fs.readFileSync("src/events/interactionCreate.js", "utf8");

intC = intC.replace(
    /else if \(customId === 'am_tgl_global_invites'\) \{\s*const config = db\.getGuildConfig\(guildId\);\s*db\.updateGuildConfig\(guildId, \{ allowInvitesGlobally: !config\.allowInvitesGlobally \}\);\s*const \{ getAutoModPanel \} = await import\('\.\.\/commands\/security\.js'\);\s*const newPanel = await getAutoModPanel\(guild\);\s*return interaction\.update\(newPanel\)\.catch\(\(\) => null\);\s*\}/,
    `else if (customId === 'am_tgl_global_invites') {
        const config = db.getGuildConfig(guildId);
        const newVal = !config.allowInvitesGlobally;
        const updateData = { allowInvitesGlobally: newVal };
        if (newVal) updateData.antiInviteEnabled = false;
        db.updateGuildConfig(guild.id, updateData);
        const { getAutoModPanel } = await import('../commands/security.js');
        const newPanel = await getAutoModPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }`
);

fs.writeFileSync("src/events/interactionCreate.js", intC);
