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
          .setDescription('Need help• Click the button below to open a private ticket. A text and voice channel will be created for you.')
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

      if (args[0]•.toLowerCase() === 'setup') {
        const categoryId = message.mentions.channels.first()•.id || args[1]•.replace(/[<#>]/g, '');
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
          .setDescription('Need help• Click the button below to open a private ticket. A text and voice channel will be created for you.')
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
