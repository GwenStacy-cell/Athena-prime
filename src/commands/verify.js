import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

export const commands = [
  {
    name: 'verify',
    description: 'Configure the server verification system',
    type: 1, // CHAT_INPUT
    default_member_permissions: String(PermissionFlagsBits.Administrator),
    options: [
      {
        name: 'setup',
        description: 'Deploy the verification panel to the current channel',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'role',
            description: 'The role to grant upon verification',
            type: 8, // ROLE
            required: true
          }
        ]
      },
      {
        name: 'disable',
        description: 'Disable the verification system and remove the panel',
        type: 1 // SUB_COMMAND
      }
    ],
    async executeSlash(interaction) {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;

      if (subcommand === 'setup') {
        await interaction.deferReply({ ephemeral: true });
        
        const role = interaction.options.getRole('role');
        
        // Ensure the bot can manage the role
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
          return interaction.editReply({ embeds: [embed.error('Permission Error', `I cannot assign ${role} because it is higher than or equal to my highest role!`)] });
        }

        const config = db.getGuildConfig(guildId);
        const accentColor = config.accentColor || '#3b82f6';

        const verifyEmbed = new EmbedBuilder()
          .setColor(accentColor)
          .setTitle('️ Server Verification')
          .setDescription('Welcome to the server! To gain access to the rest of the channels, please verify that you are human by clicking the button below.')
          .setFooter({ text: 'Athena Prime Security System', iconURL: interaction.client.user.displayAvatarURL() });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('verify_button')
              .setLabel('Verify')
              .setEmoji('<a:emoji_18:1517214419996643509>') // Custom user emoji
              .setStyle(ButtonStyle.Secondary)
          );

        const msg = await interaction.channel.send({ embeds: [verifyEmbed], components: [row] });

        db.updateVerification(guildId, {
          roleId: role.id,
          messageId: msg.id,
          channelId: interaction.channel.id
        });

        await interaction.editReply({ embeds: [embed.success('Verification Deployed', `The verification panel has been deployed successfully. Users will receive ${role} upon clicking the button.`)] });
      } 
      
      else if (subcommand === 'disable') {
        await interaction.deferReply({ ephemeral: true });
        
        const verifyData = db.getVerification(guildId);
        if (verifyData.messageId && verifyData.channelId) {
          try {
            const channel = interaction.guild.channels.cache.get(verifyData.channelId);
            if (channel) {
              const msg = await channel.messages.fetch(verifyData.messageId).catch(() => null);
              if (msg) await msg.delete();
            }
          } catch (err) {
            // ignore
          }
        }

        db.deleteVerification(guildId);
        
        await interaction.editReply({ embeds: [embed.success('Verification Disabled', 'The verification system has been disabled and the panel was removed.')] });
      }
    }
  }
];
