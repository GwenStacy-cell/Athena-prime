import fs from 'fs';

let content = fs.readFileSync('src/commands/security.js', 'utf8');

const newFunc = `export async function getAntilinkModulePanel(guild) {
  const db = (await import('../database.js')).default;
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, MessageFlags } = await import('discord.js');
  const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = await import('discord.js');
  
  const config = db.getGuildConfig(guild.id);
  const antiLinkOn = config.antiLinkEnabled;
  const antiInviteOn = config.antiInviteEnabled;
  const allowAllOn = config.allowAllLinks;
  const globalInvOn = config.allowInvitesGlobally;

  const linkRole = config.linkBypassRole ? \`<@&\${config.linkBypassRole}>\` : 'None';
  const inviteRole = config.inviteBypassRole ? \`<@&\${config.inviteBypassRole}>\` : 'None';
  const inviteChannel = config.inviteAllowedChannel ? \`<#\${config.inviteAllowedChannel}>\` : 'None';

  const TOGGLE_ON = '<:on:1514996865030946847>';
  const TOGGLE_OFF = '<:off:1514996861474177109>';
  
  const DOT = '\\u2022'; // Unicode bullet point

  const panelContainer = new ContainerBuilder();

  // Part 1: Header
  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`# ANTILINK & INVITE MODULE\n\` +
    \`**Athena Unbypassable !**\`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // Part 2: Filters Active
  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`### **Filters Active:**\n\` +
    \`-# **\${DOT} Standard URLs (unless bypassed)**\n\` +
    \`-# **\${DOT} Discord Invites**\n\` +
    \`-# **\${DOT} NSFW Links**\n\` +
    \`-# **\${DOT} Phishing & Scams**\`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // Part 3: Current Configurations
  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`### **Current Configurations:**\n\` +
    \`-# **| Anti-Link Engine:** \${antiLinkOn ? TOGGLE_ON : TOGGLE_OFF}\n\` +
    \`-# **| Anti-Invite Engine:** \${antiInviteOn ? TOGGLE_ON : TOGGLE_OFF}\n\` +
    \`-# **| Allow All Links (Global):** \${allowAllOn ? TOGGLE_ON : TOGGLE_OFF}\n\` +
    \`-# **| Allow Invites (Global):** \${globalInvOn ? TOGGLE_ON : TOGGLE_OFF}\`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // Part 4: Bypass Settings
  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`### **Bypass Settings:**\n\` +
    \`-# **| Link Bypass Role:** \${linkRole}\n\` +
    \`-# **| Invite Bypass Role:** \${inviteRole}\n\` +
    \`-# **| Invite Allowed Channel:** \${inviteChannel}\`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // Part 5: Note
  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`-# **Note: When "Allow All" is enabled, all links pass except known scams. Global invite allowance overrides the invite filter for everyone.**\`
  ));

  // Part 6: Footer
  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`-# **Athena Bulletproof Security !!!**\`
  ));

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('al_toggle_link').setLabel('Anti-Link').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_toggle_invite').setLabel('Anti-Invite').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_toggle_all_links').setLabel('Allow ALL Links').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_toggle_global_invites').setLabel('Global Invites').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_save').setLabel('Save').setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('al_select_invite_channel')
      .setPlaceholder('Select Invite Allowed Channel...')
      .setChannelTypes(ChannelType.GuildText)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('al_select_link_role')
      .setPlaceholder('Select Link Bypass Role...')
  );

  const row4 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('al_select_invite_role')
      .setPlaceholder('Select Invite Bypass Role...')
  );

  panelContainer.addActionRowComponents(row1, row2, row3, row4);

  return { components: [panelContainer], flags: MessageFlags.IsComponentsV2 };
}`;

const startIdx = content.indexOf('export async function getAntilinkModulePanel(guild) {');
if (startIdx !== -1) {
  content = content.substring(0, startIdx) + newFunc + '\n';
  fs.writeFileSync('src/commands/security.js', content, 'utf8');
  console.log('Replaced successfully');
} else {
  console.log('Function not found!');
}
