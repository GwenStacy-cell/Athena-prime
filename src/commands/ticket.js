import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';

export const commands = [
  {
    name: 'ticket',
    description: 'Configure the server support ticket system',
    type: 1, // CHAT_INPUT
    default_member_permissions: String(PermissionFlagsBits.Administrator),
    options: [
      {
        name: 'setup',
        description: 'Deploy the ticket panel to the current channel',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'category',
            description: 'The category to create tickets under',
            type: 7, // CHANNEL
            channel_types: [ChannelType.GuildCategory],
            required: true
          },
          {
            name: 'staff_role',
            description: 'The primary role that handles support tickets',
            type: 8, // ROLE
            required: true
          },
          {
            name: 'staff_role_2',
            description: 'Additional staff role',
            type: 8,
            required: false
          },
          {
            name: 'staff_role_3',
            description: 'Additional staff role',
            type: 8,
            required: false
          },
          {
            name: 'staff_role_4',
            description: 'Additional staff role',
            type: 8,
            required: false
          }
        ]
      }
    ],
    async executeSlash(interaction) {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;

      if (subcommand === 'setup') {
        await interaction.deferReply();
        
        const category = interaction.options.getChannel('category');
        const role1 = interaction.options.getRole('staff_role');
        const role2 = interaction.options.getRole('staff_role_2');
        const role3 = interaction.options.getRole('staff_role_3');
        const role4 = interaction.options.getRole('staff_role_4');
        
        const staffRoles = [role1, role2, role3, role4].filter(r => r !== null).map(r => r.id);

        const config = db.getGuildConfig(guildId);
        const accentColor = config.accentColor || '#3b82f6';

        const ticketEmbed = new EmbedBuilder()
          .setColor(accentColor)
          .setTitle(' Support Tickets')
          .setDescription('Need help? Click the button below to open a private ticket. A text and voice channel will be created for you.')
          .setFooter({ text: 'Athena Prime Support System', iconURL: interaction.client.user.displayAvatarURL() });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_open')
              .setLabel('Open Ticket')
              .setEmoji('<:139707ticket:1533859896620089485>') // Custom user emoji
              .setStyle(ButtonStyle.Primary)
          );

        await interaction.channel.send({ embeds: [ticketEmbed], components: [row] });

        db.updateTicketConfig(guildId, {
          categoryId: category.id,
          staffRoleIds: staffRoles
        });

        const roleMentions = staffRoles.map(id => `<@&${id}>`).join(', ');
        await interaction.editReply(cv2.success('Ticket System Deployed', `The ticket panel has been deployed successfully. Tickets will be created under ${category} and ${roleMentions} will be pinged.`));
      }
    },
    async executePrefix(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply(cv2.error('Missing Permission', 'You need Administrator permissions to use this command.'));
      }

      if (args[0]?.toLowerCase() === 'setup') {
        const categoryId = message.mentions.channels.first()?.id || args[1]?.replace(/[<#>]/g, '');
        const staffRoles = message.mentions.roles.map(r => r.id);

        if (!categoryId || staffRoles.length === 0) {
          return message.reply(cv2.info('Ticket Setup', 'Usage: `!ticket setup <#category> <@staffRole> [@additionalRoles...]`'));
        }

        const category = message.guild.channels.cache.get(categoryId);
        if (!category || category.type !== ChannelType.GuildCategory) {
          return message.reply(cv2.error('Invalid Category', 'Please provide a valid category.'));
        }

        const config = db.getTickets(message.guild.id);
        const guildConfig = db.getGuildConfig(message.guild.id);
        const accentColor = guildConfig.accentColor || '#3b82f6';

        if (config.panelChannelId && config.panelMessageId) {
          try {
            const oldChannel = await message.guild.channels.fetch(config.panelChannelId);
            if (oldChannel) {
              const oldMessage = await oldChannel.messages.fetch(config.panelMessageId);
              if (oldMessage) await oldMessage.delete();
            }
          } catch (err) {}
        }

        const ticketEmbed = new EmbedBuilder()
          .setColor(accentColor)
          .setTitle(' Support Tickets')
          .setDescription('Need help? Click the button below to open a private ticket. A text and voice channel will be created for you.')
          .setFooter({ text: 'Athena Prime Support System', iconURL: message.client.user.displayAvatarURL() });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_open_general')
              .setLabel('Open Ticket')
              .setEmoji('<:139707ticket:1533859896620089485>') 
              .setStyle(ButtonStyle.Primary)
          );

        const panelMsg = await message.channel.send({ embeds: [ticketEmbed], components: [row] });

        db.updateTicketConfig(message.guild.id, {
          categoryId: category.id,
          staffRoleIds: staffRoles,
          panelChannelId: message.channel.id,
          panelMessageId: panelMsg.id
        });

        const roleMentions = staffRoles.map(id => `<@&${id}>`).join(', ');
        await message.reply(cv2.success('Ticket System Deployed', `Tickets will be created under <#${category.id}> and ${roleMentions} will be pinged.`));
      } else {
        return message.reply(cv2.info('Ticket Setup', 'Usage: `!ticket setup <#category> <@staffRole> [@additionalRoles...]`\n\nFor advanced customization (dropdowns, images, etc.), use the `!ticketpanel` command!'));
      }
    }
  }
];

export async function handleTicketButtons(interaction) {
  const { customId, guild, user } = interaction;
  const db = require('../database.js').default;
  const cv2 = require('../cv2.js').default;
  
  if (customId === 'ticket_open' || customId === 'ticket_open_general') {
    const config = db.getTickets(guild.id);
    if (!config || !config.categoryId || !config.staffRoleIds || config.staffRoleIds.length === 0) {
      return interaction.reply({ content: '-# **Configuration Error:** Ticket system is not fully configured.', flags: 64 }).catch(()=>null);
    }
    
    const category = guild.channels.cache.get(config.categoryId);
    if (!category) return interaction.reply({ content: '-# **Configuration Error:** Ticket category not found.', flags: 64 }).catch(()=>null);
    
    // Check if user already has an open ticket
    let alreadyOpen = false;
    if (config.activeTickets) {
      for (const [id, data] of Object.entries(config.activeTickets)) {
         if (data.ownerId === user.id) alreadyOpen = true;
      }
    }
    
    if (alreadyOpen) {
      return interaction.reply({ content: '-# **Rate Limit:** You already have an open ticket!', flags: 64 }).catch(()=>null);
    }
    
    await interaction.reply({ content: '-# <a:Loading:1537404628826587207> **Creating your ticket...**', flags: 64 }).catch(()=>null);
    
    try {
      // First generate the ID
      config.ticketCount = (config.ticketCount || 0) + 1;
      const ticketId = config.ticketCount.toString().padStart(4, '0');
      
      const { PermissionFlagsBits } = require('discord.js');
      
      const permissionOverwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] }
      ];
      
      for (const roleId of config.staffRoleIds) {
        permissionOverwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      }
      
      const textChannel = await guild.channels.create({
        name: `ticket-${ticketId}`,
        type: 0, // GuildText
        parent: category.id,
        permissionOverwrites
      });
      
      const voiceChannel = await guild.channels.create({
        name: `Ticket ${ticketId} VC`,
        type: 2, // GuildVoice
        parent: category.id,
        permissionOverwrites: permissionOverwrites.map(p => {
          return { ...p, allow: p.allow.filter(a => a !== PermissionFlagsBits.SendMessages).concat([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]) };
        })
      });
      
      if (db.createTicket) {
         // Because db.createTicket does config.ticketCount++ internally, we just use the raw map to avoid double increment
         if (!config.activeTickets) config.activeTickets = {};
         config.activeTickets[ticketId] = {
           textId: textChannel.id,
           voiceId: voiceChannel.id,
           ownerId: user.id,
           createdAt: Date.now()
         };
         db.save();
      }
      
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const guildConfig = db.getGuildConfig(guild.id);
      
      const embed = new EmbedBuilder()
        .setColor(guildConfig.accentColor || '#3b82f6')
        .setTitle('Support Ticket')
        .setDescription(`Welcome <@${user.id}>! Please describe your issue.\nSupport will be with you shortly.\n\n-# **Voice Channel:** <#${voiceChannel.id}>`)
        .setFooter({ text: 'Athena Prime Support' });
        
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
      );
      
      await textChannel.send({
        content: `<@${user.id}> ${config.staffRoleIds.map(id => `<@&${id}>`).join(' ')}`,
        embeds: [embed],
        components: [row]
      });
      
      await interaction.editReply({ content: `-# **Ticket created:** <#${textChannel.id}>` }).catch(()=>null);
      
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '-# **Error:** Failed to create ticket channels. Ensure I have Manage Channels permission.' }).catch(()=>null);
    }
  }
  
  if (customId === 'ticket_close') {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
    
    // Check if user has permission to close
    const config = db.getTickets(guild.id);
    if (config.closeTicketRoleIds && config.closeTicketRoleIds.length > 0) {
      const hasRole = interaction.member.roles.cache.some(r => config.closeTicketRoleIds.includes(r.id));
      if (!hasRole && !interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: '-# **Permission Denied:** You do not have permission to close tickets.', flags: 64 }).catch(()=>null);
      }
    }
    
    await interaction.reply({ content: '-# <a:Loading:1537404628826587207> **Closing ticket in 5 seconds...**' }).catch(()=>null);
    
    setTimeout(async () => {
      const textChannel = interaction.channel;
      const tId = textChannel.name.replace('ticket-', '');
      
      let vId = null;
      if (config.activeTickets && config.activeTickets[tId]) {
         vId = config.activeTickets[tId].voiceId;
      }
      
      if (vId) {
         const voiceChannel = guild.channels.cache.get(vId);
         if (voiceChannel) await voiceChannel.delete().catch(()=>null);
      } else {
         const vcName = `Ticket ${tId} VC`;
         const voiceChannel = guild.channels.cache.find(c => c.name === vcName && c.parentId === textChannel.parentId);
         if (voiceChannel) await voiceChannel.delete().catch(()=>null);
      }
      
      await textChannel.delete().catch(()=>null);
      
      if (db.closeTicket) {
        db.closeTicket(guild.id, tId);
      }
    }, 5000);
  }
}
