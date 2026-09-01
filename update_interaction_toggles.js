import fs from "fs";
let text = fs.readFileSync("src/events/interactionCreate.js", "utf8");

text = text.replace(
    `      else if (customId === 'am_tgl_global_links') {
        const newVal = !config.allowAllLinks;
        const updateData = { allowAllLinks: newVal };
        if (newVal) updateData.antiLinkEnabled = false;
        db.updateGuildConfig(guild.id, updateData);
        updated = true;
      }
      else if (customId === 'am_tgl_global_invites') {
        const newVal = !config.allowInvitesGlobally;
        const updateData = { allowInvitesGlobally: newVal };
        if (newVal) updateData.antiInviteEnabled = false;
        db.updateGuildConfig(guild.id, updateData);
        updated = true;
      }`,
    `      else if (customId === 'am_tgl_hiddenurl') {
        db.updateGuildConfig(guild.id, { hiddenUrlEnabled: !(config.hiddenUrlEnabled !== false) });
        updated = true;
      }
      else if (customId === 'am_tgl_filecheck') {
        db.updateGuildConfig(guild.id, { fileCheckEnabled: !(config.fileCheckEnabled !== false) });
        updated = true;
      }`
);

fs.writeFileSync("src/events/interactionCreate.js", text);
