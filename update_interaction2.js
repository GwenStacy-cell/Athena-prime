import fs from "fs";
let text = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const startIdx = text.indexOf("if (customId.startsWith('al_')) {");
const endStr = "    return;\n  }\n\n  // Whitelist Logic";
const endIdx = text.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    const oldBlock = text.substring(startIdx, endIdx);
    
    const newBlock = `if (customId.startsWith('am_') || customId.startsWith('bp_')) {
      let updated = false;
      let targetRoleForBypass = null;

      if (customId === 'am_tgl_massmention') {
        db.updateGuildConfig(guild.id, { antiSpamMentionEnabled: !config.antiSpamMentionEnabled });
        updated = true;
      }
      else if (customId === 'am_tgl_flood') {
        db.updateGuildConfig(guild.id, { antiFloodEnabled: !(config.antiFloodEnabled !== false) });
        updated = true;
      }
      else if (customId === 'am_tgl_link') {
        const newVal = !config.antiLinkEnabled;
        const updateData = { antiLinkEnabled: newVal };
        if (newVal) updateData.allowAllLinks = false;
        db.updateGuildConfig(guild.id, updateData);
        updated = true;
      }
      else if (customId === 'am_tgl_invite') {
        const newVal = !config.antiInviteEnabled;
        const updateData = { antiInviteEnabled: newVal };
        if (newVal) updateData.allowInvitesGlobally = false;
        db.updateGuildConfig(guild.id, updateData);
        updated = true;
      }
      else if (customId === 'am_tgl_word') {
        db.updateGuildConfig(guild.id, { wordFilterEnabled: !(config.wordFilterEnabled !== false) });
        updated = true;
      }
      else if (customId === 'am_tgl_fonts') {
        db.updateGuildConfig(guild.id, { bigFontsEnabled: !(config.bigFontsEnabled !== false) });
        updated = true;
      }
      else if (customId === 'am_tgl_global_links') {
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
      }
      else if (customId === 'am_timeout_cycle') {
        const current = config.honeypotTimeoutMinutes || 15;
        let next = 15;
        if (current === 15) next = 60;
        else if (current === 60) next = 1440;
        else if (current === 1440) next = 5;
        else next = 15;
        db.updateGuildConfig(guild.id, { honeypotTimeoutMinutes: next });
        updated = true;
      }
      else if (customId === 'am_save') {
        return interaction.message.delete().catch(() => null);
      }
      else if (customId === 'am_select_invite_channel') {
        db.updateGuildConfig(guild.id, { inviteAllowedChannel: interaction.values[0] });
        updated = true;
      }
      else if (customId === 'am_select_honeypot_channel') {
        db.updateGuildConfig(guild.id, { honeypotChannelId: interaction.values[0] });
        updated = true;
      }
      else if (customId === 'am_select_granular_role') {
        targetRoleForBypass = interaction.values[0];
        updated = true;
      }
      else if (customId.startsWith('bp_')) {
        const parts = customId.split('_');
        if (parts[1] === 'back') {
          updated = true;
        } else if (parts[1] === 'all') {
          targetRoleForBypass = parts[2];
          const bypasses = config.automodBypasses || {};
          bypasses[targetRoleForBypass] = ['Anti Invite', 'Swear Words', 'URL Filter', 'Spam Filter', 'Mass Mentions', 'Anti Flood', 'Hidden URL Filter', 'Selfbot Detection', 'File Check', 'Big Fonts'];
          db.updateGuildConfig(guild.id, { automodBypasses: bypasses });
          updated = true;
        } else if (parts[1] === 'reset') {
          targetRoleForBypass = parts[2];
          const bypasses = config.automodBypasses || {};
          bypasses[targetRoleForBypass] = [];
          db.updateGuildConfig(guild.id, { automodBypasses: bypasses });
          updated = true;
        } else {
          const filterName = parts[1];
          targetRoleForBypass = parts[2];
          const bypasses = config.automodBypasses || {};
          if (!bypasses[targetRoleForBypass]) bypasses[targetRoleForBypass] = [];
          
          if (bypasses[targetRoleForBypass].includes(filterName)) {
            bypasses[targetRoleForBypass] = bypasses[targetRoleForBypass].filter(f => f !== filterName);
          } else {
            bypasses[targetRoleForBypass].push(filterName);
          }
          db.updateGuildConfig(guild.id, { automodBypasses: bypasses });
          updated = true;
        }
      }

      if (updated) {
        try {
          const sec = await import('../commands/security.js');
          let panel;
          if (targetRoleForBypass) {
            panel = await sec.getGranularBypassPanel(guild, targetRoleForBypass);
          } else {
            panel = await sec.getAutoModPanel(guild);
          }
          return interaction.update(panel);
        } catch (e) {
          console.error(e);
        }
      }
      return;
    }\n`;

    text = text.substring(0, startIdx) + newBlock + text.substring(endIdx);
    fs.writeFileSync("src/events/interactionCreate.js", text);
} else {
    console.log("Could not find start or end index!");
}
