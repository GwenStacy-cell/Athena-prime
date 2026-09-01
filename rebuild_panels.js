import fs from "fs";
let sec = fs.readFileSync("src/commands/security.js", "utf8");

// We will completely replace getAutoModPanel and getChannelConfigPanel to match the new structure.

const oldGetAutoModPanelRegex = /export async function getAutoModPanel\(guild\) \{[\s\S]*?return \{ components: \[panelContainer\], flags: MessageFlags\.IsComponentsV2 \};\s*\}/;
const oldGetChannelConfigPanelRegex = /export async function getChannelConfigPanel\(guild\) \{[\s\S]*?return \{ components: \[c\], flags: MessageFlags\.IsComponentsV2 \};\s*\}/;

const newAutoModPanel = `export async function getAutoModPanel(guild) {
  const db = (await import('../database.js')).default;
  const config = db.getGuildConfig(guild.id);
  
  const spamMentionOn = config.antiSpamMentionEnabled === true;
  const antiFloodOn = config.antiFloodEnabled !== false;
  const antiLinkOn = config.antiLinkEnabled !== false;
  const antiInviteOn = config.antiInviteEnabled !== false;
  const wordFilterOn = config.wordFilterEnabled !== false;
  const bigFontsOn = config.bigFontsEnabled !== false;
  const hiddenUrlOn = config.hiddenUrlEnabled !== false;
  const fileCheckOn = config.fileCheckEnabled !== false;
  const selfbotOn = config.selfbotDetectionEnabled !== false;
  
  const TOGGLE_ON = '<:on:1514996865030946847>';
  const TOGGLE_OFF = '<:off:1514996861474177109>';
  const DOT = '<:dark4luvontop:1533860081916182721>';
  const E_CLOCK = '🕒';

  const inviteChannel = config.inviteAllowedChannel ? \`<#\${config.inviteAllowedChannel}>\` : 'None';
  const honeypotChannel = config.honeypotChannelId ? \`<#\${config.honeypotChannelId}>\` : 'None';
  const honeypotTimeout = config.honeypotTimeoutMinutes || 15;

  const bypasses = config.automodBypasses || {};
  let bypassText = '';
  const bypassedRolesKeys = Object.keys(bypasses);
  if (bypassedRolesKeys.length === 0) {
    bypassText = \`-# **| No granular bypasses configured.**\`;
  } else {
    for (const rId of bypassedRolesKeys) {
      if (bypasses[rId] && bypasses[rId].length > 0) {
          const displayStr = bypasses[rId].length >= 10 ? 'All Automoderation Events' : bypasses[rId].join(', ');
          bypassText += \`-# **| <@&\${rId}> Bypasses:** \${displayStr}\\n\`;
        }
    }
  }

  const { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType } = await import('discord.js');
  
  const panelContainer = new ContainerBuilder();

  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`# AUTOMOD | HEURISTIC FILTERING & SECURITY MATRIX\\n\` +
    \`**Athena Unbypassable !**\`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`### **Filters Active:**\\n\` +
    \`-# **\${DOT} Mass Mention / Spam Tag Filter**\\n\` +
    \`-# **\${DOT} Anti Flood Filter**\\n\` +
    \`-# **\${DOT} Standard URLs (unless bypassed)**\\n\` +
    \`-# **\${DOT} Discord Invites**\\n\` +
    \`-# **\${DOT} NSFW Links**\\n\` +
    \`-# **\${DOT} Phishing & Scams**\\n\` +
    \`-# **\${DOT} Anti-Profanity / Blacklisted Words**\\n\` +
    \`-# **\${DOT} Big Fonts (Anti Full Caps)**\\n\` +
    \`-# **\${DOT} Selfbot Detection (Rich Embeds)**\\n\` +
    \`-# **\${DOT} Escalating Punishments**\\n\` +
    \`-# **\${DOT} Max Warnings Count Set**\`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`### **Current Configurations:**\\n\` +
    \`-# **| Mass Mention Filter:** \${spamMentionOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Anti Flood Engine:** \${antiFloodOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Anti-Link Engine:** \${antiLinkOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Anti-Invite Engine:** \${antiInviteOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Word Filter:** \${wordFilterOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Big Fonts:** \${bigFontsOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Selfbot Detection:** \${selfbotOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Hidden URL Filter:** \${hiddenUrlOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| File Check Filter:** \${fileCheckOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Allow All Links (Global):** \${config.allowAllLinks ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Allow Invites (Global):** \${config.allowInvitesGlobally ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Max Warnings Threshold:** \${config.maxWarnings || 3} (Use \\\`!maxwarnings <number>\\\` to modify)\\n\` +
    \`-# **| Honeypot Timeout:** \${honeypotTimeout}m\`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`### **Bypass Settings:**\\n\` +
    (bypassText.trim() ? bypassText.trim() + '\\n' : '') +
    \`-# **| Invite Allowed Channel:** \${inviteChannel}\\n\` +
    \`-# **| Honeypot Channel:** \${honeypotChannel}\`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`-# **Athena Bulletproof Security !!!**\`
  ));

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('am_tgl_massmention').setLabel('Mass Mention').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_flood').setLabel('Anti Flood').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_link').setLabel('Anti-Link').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_invite').setLabel('Anti-Invite').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_word').setLabel('Word Filter').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('am_tgl_fonts').setLabel('Big Fonts').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_hiddenurl').setLabel('Hidden URLs').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_filecheck').setLabel('File Check').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_selfbot').setLabel('Selfbot Detection').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_advanced_configs').setLabel('\u2699\ufe0f Advanced Settings').setStyle(ButtonStyle.Primary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('am_select_granular_role')
      .setPlaceholder('Select Target Role to Configure Bypasses...')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('am_select_invite_channel')
      .setPlaceholder('Select Invite Allowed Channel...')
      .setChannelTypes(ChannelType.GuildText)
  );

  const row5 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('am_select_honeypot_channel')
      .setPlaceholder('Select Honeypot Trap Channel...')
      .setChannelTypes(ChannelType.GuildText)
  );

  panelContainer.addActionRowComponents(row1, row2, row3, row4, row5);
  return { components: [panelContainer], flags: MessageFlags.IsComponentsV2 };
}`;

const newAdvancedConfigPanel = `export async function getAdvancedConfigPanel(guild) {
  const db = (await import('../database.js')).default;
  const config = db.getGuildConfig(guild.id);
  
  const { ContainerBuilder, TextDisplayBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
  
  const c = new ContainerBuilder();
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`# AUTOMOD | ADVANCED GLOBAL SETTINGS\\n\` +
    \`-# **| Allow All Links (Global):** \${config.allowAllLinks ? '<:on:1514996865030946847>' : '<:off:1514996861474177109>'}\\n\` +
    \`-# **| Allow Invites (Global):** \${config.allowInvitesGlobally ? '<:on:1514996865030946847>' : '<:off:1514996861474177109>'}\`
  ));
  
  const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('am_tgl_global_links').setLabel('Allow ALL Links').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_global_invites').setLabel('Global Invites').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Automod').setStyle(ButtonStyle.Primary)
  );
  
  c.addActionRowComponents(row1, row2);
  return { components: [c], flags: MessageFlags.IsComponentsV2 };
}`;

sec = sec.replace(oldGetAutoModPanelRegex, newAutoModPanel);
sec = sec.replace(oldGetChannelConfigPanelRegex, newAdvancedConfigPanel);

fs.writeFileSync("src/commands/security.js", sec);
console.log("Replaced security.js successfully");
