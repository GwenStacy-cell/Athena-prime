import { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';

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
      .setLabel('Save & Close')
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
        return message.reply(cv2.error('Missing Permission', 'You need Administrator permissions to use this command.'));
      }

      await updateManagerMessage(message);
    }
  }
];

export async function handleTicketPanelButtons(interaction) {
  const { customId, guild } = interaction;
  const db = require('../database.js').default;
  const cv2 = require('../cv2.js').default;
  
  if (customId === 'tp_edit_text') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const config = db.getTickets(guild.id);
    
    const modal = new ModalBuilder().setCustomId('tp_modal_text').setTitle('Edit Panel Text');
    
    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Panel Title')
      .setStyle(TextInputStyle.Short)
      .setValue(config.panelTitle || 'Support Tickets')
      .setRequired(true);
      
    const descInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Panel Description')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(config.panelDescription || 'Need help? Open a ticket below.')
      .setRequired(true);
      
    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput));
    return interaction.showModal(modal);
  }
  
  if (customId === 'tp_edit_media') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const config = db.getTickets(guild.id);
    
    const modal = new ModalBuilder().setCustomId('tp_modal_media').setTitle('Edit Panel Media');
    
    const imageInput = new TextInputBuilder()
      .setCustomId('image')
      .setLabel('Large Image URL')
      .setStyle(TextInputStyle.Short)
      .setValue(config.panelImage || '')
      .setRequired(false);
      
    const thumbInput = new TextInputBuilder()
      .setCustomId('thumbnail')
      .setLabel('Thumbnail URL')
      .setStyle(TextInputStyle.Short)
      .setValue(config.panelThumbnail || '')
      .setRequired(false);
      
    modal.addComponents(new ActionRowBuilder().addComponents(imageInput), new ActionRowBuilder().addComponents(thumbInput));
    return interaction.showModal(modal);
  }
  
  if (customId === 'tp_deploy') {
    const config = db.getTickets(guild.id);
    if (!config.targetChannelId) {
       return interaction.reply({ content: '-# **Error:** Please select a target channel from the dropdown first!', flags: 64 }).catch(()=>null);
    }
    
    const targetChannel = guild.channels.cache.get(config.targetChannelId);
    if (!targetChannel) {
       return interaction.reply({ content: '-# **Error:** Target channel not found.', flags: 64 }).catch(()=>null);
    }
    
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const guildConfig = db.getGuildConfig(guild.id);
    const embed = new EmbedBuilder()
      .setColor(guildConfig.accentColor || '#3b82f6')
      .setTitle(config.panelTitle || 'Support Tickets')
      .setDescription(config.panelDescription || 'Need help? Click the button below to open a private ticket. A text and voice channel will be created for you.')
      .setFooter({ text: 'Athena Prime Ticket System' });
      
    if (config.panelImage) embed.setImage(config.panelImage);
    if (config.panelThumbnail) embed.setThumbnail(config.panelThumbnail);
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_open_general').setLabel('Open Ticket').setEmoji('<:139707ticket:1533859896620089485>').setStyle(ButtonStyle.Primary)
    );
    
    await targetChannel.send({ embeds: [embed], components: [row] }).catch(()=>null);
    return interaction.reply({ content: `-# **Success:** Ticket panel deployed to <#${config.targetChannelId}>!`, flags: 64 }).catch(()=>null);
  }
  
  if (customId === 'tp_cancel') {
    return interaction.message.delete().catch(()=>null);
  }
}

export async function handleTicketPanelMenus(interaction) {
  const { customId, guild, values } = interaction;
  const db = require('../database.js').default;
  
  if (customId === 'tp_target_channel') {
    db.updateTicketConfig(guild.id, { targetChannelId: values[0] });
    await interaction.deferUpdate();
    return updateManagerMessage(interaction.message);
  }
  
  if (customId === 'tp_close_roles') {
    db.updateTicketConfig(guild.id, { closeTicketRoleIds: values });
    await interaction.deferUpdate();
    return updateManagerMessage(interaction.message);
  }
}

export async function handleTicketPanelModals(interaction) {
  const { customId, guild, fields } = interaction;
  const db = require('../database.js').default;
  
  if (customId === 'tp_modal_text') {
    db.updateTicketConfig(guild.id, {
      panelTitle: fields.getTextInputValue('title'),
      panelDescription: fields.getTextInputValue('description')
    });
    await interaction.deferUpdate();
    return updateManagerMessage(interaction.message);
  }
  
  if (customId === 'tp_modal_media') {
    db.updateTicketConfig(guild.id, {
      panelImage: fields.getTextInputValue('image') || null,
      panelThumbnail: fields.getTextInputValue('thumbnail') || null
    });
    await interaction.deferUpdate();
    return updateManagerMessage(interaction.message);
  }
}
