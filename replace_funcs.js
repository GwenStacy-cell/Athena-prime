import fs from "fs";

let text = fs.readFileSync("src/commands/security.js", "utf8");

const startIdx = text.indexOf("export async function getAntilinkModulePanel(guild) {");
const endStr = "return { components: [panelContainer], flags: MessageFlags.IsComponentsV2 };\n}";
const endIdx = text.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const newFuncs = `export async function getAutoModPanel(guild) {
  const db = (await import('../database.js')).default;
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, MessageFlags } = await import('discord.js');
  const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = await import('../cv2.js');

  const config = db.getGuildConfig(guild.id);
  
  const TOGGLE_ON = '<:on:1514996865030946847>';
  const TOGGLE_OFF = '<:off:1514996861474177109>';
  const DOT = '\\u2022';

  const antiLinkOn = config.antiLinkEnabled;
  const antiInviteOn = config.antiInviteEnabled;
  const wordFilterOn = config.wordFilterEnabled !== false;
  const bigFontsOn = config.bigFontsEnabled !== false;
  const antiFloodOn = config.antiFloodEnabled !== false;
  const spamMentionOn = config.antiSpamMentionEnabled;
  const allowAllOn = config.allowAllLinks === true;
  const globalInvOn = config.allowInvitesGlobally === true;

  const honeypotChannel = config.honeypotChannelId ? \`<#\${config.honeypotChannelId}>\` : 'None';
  const honeypotTimeout = config.honeypotTimeoutMinutes || 15;
  const inviteChannel = config.inviteAllowedChannel ? \`<#\${config.inviteAllowedChannel}>\` : 'None';

  const bypasses = config.automodBypasses || {};
  let bypassText = '';
  const bypassedRolesKeys = Object.keys(bypasses);
  if (bypassedRolesKeys.length === 0) {
    bypassText = \`-# **| No granular bypasses configured.**\`;
  } else {
    for (const rId of bypassedRolesKeys) {
      if (bypasses[rId] && bypasses[rId].length > 0) {
        bypassText += \`-# **| <@&\${rId}> Bypasses:** \${bypasses[rId].join(', ')}\\n\`;
      }
    }
  }

  const panelContainer = new ContainerBuilder();

  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`# AUTOMATED MODERATION & SECURITY MATRIX\\n\` +
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
    \`-# **| Allow All Links (Global):** \${allowAllOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Allow Invites (Global):** \${globalInvOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`-# **| Max Warnings Threshold:** \${config.maxWarnings || 3}\\n\` +
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
    new ButtonBuilder().setCustomId('am_tgl_global_links').setLabel('Allow ALL Links').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_global_invites').setLabel('Global Invites').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_timeout_cycle').setLabel(\`Honeypot Timeout: \${honeypotTimeout}m\`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_save').setLabel('Save').setStyle(ButtonStyle.Success)
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
}

export async function getGranularBypassPanel(guild, roleId) {
  const db = (await import('../database.js')).default;
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = await import('discord.js');
  const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = await import('../cv2.js');

  const config = db.getGuildConfig(guild.id);
  const bypasses = config.automodBypasses || {};
  const roleBypasses = bypasses[roleId] || [];

  const checkBypass = (key) => roleBypasses.includes(key);

  const E_GREEN = '\ud83d\udfe2'; 
  const E_RED = '\ud83d\udd34'; 
  const E_CLOCK = '\u23f0'; 

  const status = (key) => checkBypass(key) ? \`\${E_GREEN} **\${key}:** Bypassed\` : \`\${E_RED} **\${key}:** Enforced\`;

  const panelContainer = new ContainerBuilder();

  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`# AutoMod | Granular Bypass Config\\n\\n\` +
    \`**Target Role:** <@&\${roleId}>\\n\` +
    \`-# \${status('Anti Invite')}\\n\` +
    \`-# \${status('Swear Words')}\\n\` +
    \`-# \${status('URL Filter')}\\n\` +
    \`-# \${status('Spam Filter')}\\n\` +
    \`-# \${status('Mass Mentions')}\\n\` +
    \`-# \${status('Anti Flood')}\\n\` +
    \`-# \${status('Hidden URL Filter')}\\n\` +
    \`-# \${status('Selfbot Detection')}\\n\` +
    \`-# \${status('File Check')}\\n\` +
    \`-# \${status('Big Fonts')}\\n\` +
    \`-# \${E_CLOCK} **File Timeout Duration:** 15 mins\`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`-# **Secure Unbypassable Security**\`
  ));

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(\`bp_Anti Invite_\${roleId}\`).setLabel('Anti Invite').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(\`bp_Swear Words_\${roleId}\`).setLabel('Swear Words').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(\`bp_URL Filter_\${roleId}\`).setLabel('URL Filter').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(\`bp_Spam Filter_\${roleId}\`).setLabel('Spam Filter').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(\`bp_Mass Mentions_\${roleId}\`).setLabel('Mass Mentions').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(\`bp_Anti Flood_\${roleId}\`).setLabel('Anti Flood').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(\`bp_Hidden URL Filter_\${roleId}\`).setLabel('Hidden URL Filter').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(\`bp_Selfbot Detection_\${roleId}\`).setLabel('Selfbot Detection').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(\`bp_File Check_\${roleId}\`).setLabel('File Check').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(\`bp_Big Fonts_\${roleId}\`).setLabel('Big Fonts').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(\`bp_all_\${roleId}\`).setLabel('Bypass All').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(\`bp_reset_\${roleId}\`).setLabel('Reset All').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(\`bp_back\`).setLabel('Back to Overview').setStyle(ButtonStyle.Primary)
  );

  panelContainer.addActionRowComponents(row1, row2, row3);

  return { components: [panelContainer], flags: MessageFlags.IsComponentsV2 };
}`;

    text = text.substring(0, startIdx) + newFuncs + text.substring(endIdx + endStr.length);
    fs.writeFileSync("src/commands/security.js", text);
} else {
    console.log("Could not find start or end index!");
}
