import fs from 'fs';
let code = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

const anchor = `    if (customId === 'sec_close') {
      try {
        return interaction.message.delete();
      } catch(e) { console.error(e); }
    }`;

const injectedBlock = `
    if (['toggle_antinuke', 'toggle_spam', 'toggle_invite', 'cycle_punishment', 'sec_status_back', 'save_panel'].includes(customId)) {
      try {
        let updated = false;
        const updateData = {};
        
        if (customId === 'toggle_antinuke') {
          updateData.antiNukeEnabled = !config.antiNukeEnabled;
          updated = true;
        }
        if (customId === 'toggle_spam') {
          updateData.antiSpamEnabled = !config.antiSpamEnabled;
          updated = true;
        }
        if (customId === 'toggle_invite') {
          updateData.antiInviteEnabled = (config.antiInviteEnabled === false) ? true : false;
          updated = true;
        }
        if (customId === 'cycle_punishment') {
          const current = config.antiNukePunishment || 'ban';
          updateData.antiNukePunishment = current === 'ban' ? 'kick' : current === 'kick' ? 'quarantine' : 'ban';
          updated = true;
        }
        if (customId === 'sec_status_back') {
           const sec = await import('../commands/security.js');
           return interaction.update(await sec.getSecurityStatusPanel(guild));
        }
        if (customId === 'save_panel') {
           return interaction.message.delete();
        }

        if (updated) {
          const db = (await import('../db.js')).default;
          db.updateGuildConfig(guild.id, updateData);
          const sec = await import('../commands/security.js');
          return interaction.update(await sec.getAntinukeConfigPanel(guild));
        }
      } catch (e) { console.error(e); }
    }
    
    if (customId === 'toggle_blacklist_filter') {
        return interaction.reply({ content: 'Use \`!blacklist add <word>\` to enable the word filter, or \`!blacklist remove <word>\` to disable it.', ephemeral: true });
    }
`;

if (code.includes(anchor)) {
    code = code.replace(anchor, anchor + "\n" + injectedBlock);
    fs.writeFileSync('src/events/interactionCreate.js', code);
    console.log("Injected security toggles!");
} else {
    console.log("Could not find anchor!");
}
