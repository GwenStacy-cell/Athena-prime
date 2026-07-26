import { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

export async function updateManagerMessage(message) {
  const guildId = message.guild.id;
  const config = db.getTickets(guildId);
  const guildConfig = db.getGuildConfig(guildId);
  const accentColor = guildConfig.accentColor || '#3b82f6';

  const panelStatusEmbed = new EmbedBuilder()
    .setColor(accentColor)
    .setTitle('Ticket Panel Manager')
    .setDescription('Use the buttons below to fully customize your Ticket Panel. When ready, click **Deploy Panel**.')
    .addFields(
      { name: 'Title', value: config.panelTitle || 'Support Tickets', inline: true },
      { name: 'Options', value: (config.panelOptions || []).length.toString(), inline: true },
      { name: 'Placeholder', value: config.panelPlaceholder || 'Select a reason...', inline: true },
      { name: 'Description', value: (config.panelDescription || 'Need help? Open a ticket below.').substring(0, 1024) },
      { name: 'Image', value: config.panelImage ? '[Link](' + config.panelImage + ')' : 'None', inline: true },
      { name: 'Thumbnail', value: config.panelThumbnail ? '[Link](' + config.panelThumbnail + ')' : 'None', inline: true }
    )
    .setFooter({ text: 'Athena Prime Ticket System' });

  const targetChannelText = config.targetChannelId ? `<#${config.targetChannelId}>` : 'Current Channel';
  panelStatusEmbed.addFields({ name: 'Target Channel', value: targetChannelText, inline: true });

  const closeRolesText = config.closeTicketRoleIds && config.closeTicketRoleIds.length > 0 
    ? config.closeTicketRoleIds.map(id => `<@&${id}>`).join(' ') 
    : 'Anyone (Default)';
  panelStatusEmbed.addFields({ name: 'Closing Roles', value: closeRolesText, inline: true });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tp_edit_text')
      .setLabel('Edit Title & Desc')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tp_edit_media')
      .setLabel('Edit Media & Placeholder')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tp_add_option')
      .setLabel('Add Option')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tp_clear_options')
      .setLabel('Clear Options')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('tp_test')
      .setLabel('Test Panel')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tp_deploy')
      .setLabel('Deploy Panel')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('tp_cancel')
      .setLabel('Close')
      .setStyle(ButtonStyle.Secondary)
  );

  const { ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType } = await import('discord.js');
  const row3 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('tp_target_channel')
      .setPlaceholder('Select target channel for deployment...')
      .setChannelTypes(ChannelType.GuildText)
  );

  const row4 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('tp_close_roles')
      .setPlaceholder('Select roles that can close tickets (leave empty for everyone)...')
      .setMinValues(1)
      .setMaxValues(10)
  );

  if (message.author.id === message.client.user.id) {
    await message.edit({ embeds: [panelStatusEmbed], components: [row3, row4, row1, row2] }).catch(() => null);
  } else {
    await message.reply({ embeds: [panelStatusEmbed], components: [row3, row4, row1, row2] });
  }
}

export const commands = [
  {
    name: 'ticketpanel',
    description: 'Launch the interactive ticket panel manager',
    type: 1,
    default_member_permissions: String(PermissionFlagsBits.Administrator),
    async executePrefix(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [embed.error('Missing Permission', 'You need Administrator permissions to use this command.')] });
      }

      await updateManagerMessage(message);
    }
  }
];
