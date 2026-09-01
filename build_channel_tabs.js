import fs from "fs";

// 1. Refactor security.js
let sec = fs.readFileSync("src/commands/security.js", "utf8");

const oldRows = `    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('am_tgl_fonts').setLabel('Big Fonts').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_hiddenurl').setLabel('Hidden URLs').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_filecheck').setLabel('File Check').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_global_links').setLabel('Allow ALL Links').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_global_invites').setLabel('Global Invites').setStyle(ButtonStyle.Secondary)
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
  
    panelContainer.addActionRowComponents(row1, row2, row3, row4, row5);`;

const newRows = `    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('am_tgl_fonts').setLabel('Big Fonts').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_hiddenurl').setLabel('Hidden URLs').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_filecheck').setLabel('File Check').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_selfbot').setLabel('Selfbot Detection').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_global_links').setLabel('Allow ALL Links').setStyle(ButtonStyle.Secondary)
    );
  
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('am_tgl_global_invites').setLabel('Global Invites').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_channel_configs').setLabel('⚙️ Configure Channels').setStyle(ButtonStyle.Primary)
    );

    const row4 = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('am_select_granular_role')
        .setPlaceholder('Select Target Role to Configure Bypasses...')
        .setMinValues(1)
        .setMaxValues(1)
    );
  
    panelContainer.addActionRowComponents(row1, row2, row3, row4);`;

sec = sec.replace(oldRows, newRows);

const subPanelCode = `
export async function getChannelConfigPanel(guild) {
  const db = (await import('../database.js')).default;
  const config = db.getGuildConfig(guild.id);
  const inviteChannel = config.inviteAllowedChannel ? \`<#\${config.inviteAllowedChannel}>\` : 'None';
  const honeypotChannel = config.honeypotChannelId ? \`<#\${config.honeypotChannelId}>\` : 'None';
  
  const c = new ContainerBuilder();
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    \`# AUTOMOD | CHANNEL CONFIGURATIONS\\n\` +
    \`-# **| Invite Allowed Channel:** \${inviteChannel}\\n\` +
    \`-# **| Honeypot Trap Channel:** \${honeypotChannel}\`
  ));
  
  const row1 = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('am_select_invite_channel')
        .setPlaceholder('Select Invite Allowed Channel...')
        .setChannelTypes(ChannelType.GuildText)
  );
  const row2 = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('am_select_honeypot_channel')
        .setPlaceholder('Select Honeypot Trap Channel...')
        .setChannelTypes(ChannelType.GuildText)
  );
  const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Automod').setStyle(ButtonStyle.Primary)
  );
  
  c.addActionRowComponents(row1, row2, row3);
  return { components: [c], flags: MessageFlags.IsComponentsV2 };
}
`;

sec = sec + subPanelCode;
fs.writeFileSync("src/commands/security.js", sec);

// 2. Refactor interactionCreate.js
let intC = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const oldTgl = `else if (customId === 'am_tgl_global_invites') {
        const config = db.getGuildConfig(guildId);
        db.updateGuildConfig(guildId, { allowInvitesGlobally: !config.allowInvitesGlobally });
        const { getAutoModPanel } = await import('../commands/security.js');
        const newPanel = await getAutoModPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }`;

const newTgl = `else if (customId === 'am_tgl_selfbot') {
        const config = db.getGuildConfig(guildId);
        const current = config.selfbotDetectionEnabled !== false;
        db.updateGuildConfig(guildId, { selfbotDetectionEnabled: !current });
        const { getAutoModPanel } = await import('../commands/security.js');
        const newPanel = await getAutoModPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      else if (customId === 'am_tgl_global_invites') {
        const config = db.getGuildConfig(guildId);
        db.updateGuildConfig(guildId, { allowInvitesGlobally: !config.allowInvitesGlobally });
        const { getAutoModPanel } = await import('../commands/security.js');
        const newPanel = await getAutoModPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      else if (customId === 'am_channel_configs') {
        const { getChannelConfigPanel } = await import('../commands/security.js');
        const newPanel = await getChannelConfigPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      else if (customId === 'am_back_to_main') {
        const { getAutoModPanel } = await import('../commands/security.js');
        const newPanel = await getAutoModPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }`;

intC = intC.replace(oldTgl, newTgl);

fs.writeFileSync("src/events/interactionCreate.js", intC);

