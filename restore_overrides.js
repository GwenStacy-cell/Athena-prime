import fs from "fs";

// 1. Update security.js
let secText = fs.readFileSync("src/commands/security.js", "utf8");

// Restore texts
secText = secText.replace(
    "`-# **| Hidden URL Filter:** ${hiddenUrlOn ? TOGGLE_ON : TOGGLE_OFF}\\n` +\n    `-# **| File Check Filter:** ${fileCheckOn ? TOGGLE_ON : TOGGLE_OFF}\\n` +",
    "`-# **| Hidden URL Filter:** ${hiddenUrlOn ? TOGGLE_ON : TOGGLE_OFF}\\n` +\n    `-# **| File Check Filter:** ${fileCheckOn ? TOGGLE_ON : TOGGLE_OFF}\\n` +\n    `-# **| Allow All Links (Global):** ${config.allowAllLinks ? TOGGLE_ON : TOGGLE_OFF}\\n` +\n    `-# **| Allow Invites (Global):** ${config.allowInvitesGlobally ? TOGGLE_ON : TOGGLE_OFF}\\n` +"
);

// Restore buttons & remove timeout button
secText = secText.replace(
    "new ButtonBuilder().setCustomId('am_tgl_hiddenurl').setLabel('Hidden URLs').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId('am_tgl_filecheck').setLabel('File Check').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId('am_timeout_cycle').setLabel(`Honeypot Timeout: ${honeypotTimeout}m`).setStyle(ButtonStyle.Secondary)",
    "new ButtonBuilder().setCustomId('am_tgl_hiddenurl').setLabel('Hidden URLs').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId('am_tgl_filecheck').setLabel('File Check').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId('am_tgl_global_links').setLabel('Allow ALL Links').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId('am_tgl_global_invites').setLabel('Global Invites').setStyle(ButtonStyle.Secondary)"
);

fs.writeFileSync("src/commands/security.js", secText);

// 2. Update interactionCreate.js
let intText = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// Add timeout input to modal
intText = intText.replace(
    "modal.addComponents(new ActionRowBuilder().addComponents(bannerInput));",
    `        const timeoutInput = new TextInputBuilder()
          .setCustomId('timeout_minutes')
          .setLabel('Timeout Duration (Minutes)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('15');
          
        modal.addComponents(new ActionRowBuilder().addComponents(bannerInput), new ActionRowBuilder().addComponents(timeoutInput));`
);

// Read timeout input in modal handler
intText = intText.replace(
    "const bannerUrl = interaction.fields.getTextInputValue('banner_url') || null;\n        \n        const db = (await import('../database.js')).default;\n        db.updateGuildConfig(interaction.guild.id, { honeypotChannelId: channelId });\n        \n        const config = db.getGuildConfig(interaction.guild.id);\n        const timeoutMinutes = config.honeypotTimeoutMinutes || 15;",
    `const bannerUrl = interaction.fields.getTextInputValue('banner_url') || null;
        let timeoutVal = interaction.fields.getTextInputValue('timeout_minutes');
        let parsedTimeout = parseInt(timeoutVal);
        if (isNaN(parsedTimeout) || parsedTimeout < 1) parsedTimeout = 15;
        
        const db = (await import('../database.js')).default;
        db.updateGuildConfig(interaction.guild.id, { honeypotChannelId: channelId, honeypotTimeoutMinutes: parsedTimeout });
        
        const config = db.getGuildConfig(interaction.guild.id);
        const timeoutMinutes = config.honeypotTimeoutMinutes || 15;`
);

// Restore the toggle handlers
const toggleHandlers = `
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
      }`;

intText = intText.replace(
    "else if (customId === 'am_timeout_cycle') {",
    toggleHandlers.trim() + "\n      else if (customId === 'am_timeout_cycle') {"
);

fs.writeFileSync("src/events/interactionCreate.js", intText);
