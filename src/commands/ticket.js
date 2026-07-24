import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

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
              .setEmoji('<:139707ticket:1517458763773251745>') // Custom user emoji
              .setStyle(ButtonStyle.Primary)
          );

        await interaction.channel.send({ embeds: [ticketEmbed], components: [row] });

        db.updateTicketConfig(guildId, {
          categoryId: category.id,
          staffRoleIds: staffRoles
        });

        const roleMentions = staffRoles.map(id => `<@&${id}>`).join(', ');
        await interaction.editReply({ embeds: [embed.success('Ticket System Deployed', `The ticket panel has been deployed successfully. Tickets will be created under ${category} and ${roleMentions} will be pinged.`)] });
      }
    }
  }
];
