import fs from 'fs';
const panelCode = `

export async function getAntilinkModulePanel(guild) {
  const db = (await import('../database.js')).default;
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, MessageFlags } = await import('discord.js');
  const { ContainerBuilder, TextDisplayBuilder } = await import('discord.js'); // Assuming these are correctly imported in the file or we can just rely on the existing imports
  
  // Wait, let's just use the exact panelCode that assumes globals in security.js
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

  const description = 
    \`# ANTILINK & INVITE MODULE\\n\` +
    \`**Athena Unbypassable !**\\n\\n\` +
    \`**Filters Active:**\\n\` +
    \`| <:dark4luvontop:1533860081916182721> Standard URLs (unless bypassed)\\n\` +
    \`| <:dark4luvontop:1533860081916182721> Discord Invites\\n\` +
    \`| <:dark4luvontop:1533860081916182721> NSFW Links\\n\` +
    \`| <:dark4luvontop:1533860081916182721> Phishing & Scams\\n\\n\` +
    \`**Current Configurations:**\\n\` +
    \`| **Anti-Link Engine:** \${antiLinkOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`| **Anti-Invite Engine:** \${antiInviteOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`| **Allow All Links (Global):** \${allowAllOn ? TOGGLE_ON : TOGGLE_OFF}\\n\` +
    \`| **Allow Invites (Global):** \${globalInvOn ? TOGGLE_ON : TOGGLE_OFF}\\n\\n\` +
    \`**Bypass Settings:**\\n\` +
    \`| **Link Bypass Role:** \${linkRole}\\n\` +
    \`| **Invite Bypass Role:** \${inviteRole}\\n\` +
    \`| **Invite Allowed Channel:** \${inviteChannel}\\n\\n\` +
    \`*Note: When "Allow All" is enabled, all links pass except known scams. Global invite allowance overrides the invite filter for everyone.*\`;

  // We rely on the existing imports in security.js: TextDisplayBuilder, ContainerBuilder, ActionRowBuilder, etc.
  const mainDisplay = new TextDisplayBuilder().setContent(description);
  const panelContainer = new ContainerBuilder().addTextDisplayComponents(mainDisplay);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('al_toggle_link').setLabel('Anti-Link').setStyle(antiLinkOn ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_toggle_invite').setLabel('Anti-Invite').setStyle(antiInviteOn ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_toggle_all_links').setLabel('Allow ALL Links').setStyle(allowAllOn ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_toggle_global_invites').setLabel('Global Invites').setStyle(globalInvOn ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_close').setLabel('Close').setStyle(ButtonStyle.Danger)
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

  return { components: [panelContainer, row1, row2, row3, row4], flags: MessageFlags.IsComponentsV2 };
}
`;

let content = fs.readFileSync('src/commands/security.js', 'utf8');
content += panelCode;
fs.writeFileSync('src/commands/security.js', content, 'utf8');
