import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';

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
        await interaction.deferReply({ ephemeral: true }); // Keep wizard hidden
        
        const role = interaction.options.getRole('role');
        
        // Ensure the bot can manage the role
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
          return interaction.editReply(cv2.error('Permission Error', `I cannot assign ${role} because it is higher than or equal to my highest role!`));
        }

        const rawPayload = {
          content: "",
          components: [
            {
              type: 17, // ContainerBuilder
              components: [
                {
                  type: 10, // TextDisplayBuilder
                  content: "## **System Authentication**\n\n-# **Welcome to the server! Access to standard channels is currently restricted.**\n-# **To gain entry, you must verify your identity by clicking the authentication button below.**\n\n<:info_jtc:1524111455404953663> **__Authentication Details__**\n-# **\u2022 Account verification prevents automated bot raids.**\n-# **\u2022 Ensure your DMs are open to receive status updates.**\n-# **\u2022 Failure to authenticate may result in removal.**"
                }
              ]
            },
            {
              type: 1, // ActionRow
              components: [
                {
                  type: 2, // Button
                  custom_id: "verify_button",
                  label: "Authenticate Identity",
                  style: 2, // Secondary (Grey)
                  emoji: { id: "1524120618864214206" } // <:permit_jtc:>
                }
              ]
            }
          ],
          flags: 32768 // MessageFlags.IsComponentsV2
        };

        const msg = await interaction.channel.send(rawPayload);

        db.updateVerification(guildId, {
          roleId: role.id,
          messageId: msg.id,
          channelId: interaction.channel.id
        });

        
        const promptEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('<:status_jtc:1524089009163337758> Verification Panel Deployed!')
          .setDescription(`The panel is live. Users clicking the button will now receive ${role}.\n\n**Would you like Athena Prime to automatically configure the server permissions for you?**\n\nIf you select **Auto-Configure**, I will:\n1. Disable \`View Channels\` globally for \`@everyone\`.\n2. Enable \`View Channels\` globally for the ${role} role.\n3. Make sure *this* verification channel remains visible to everyone.`);

        const promptRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('auto_conf').setLabel('Auto-Configure').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('manual_conf').setLabel("I'll do it manually").setStyle(ButtonStyle.Secondary)
        );

        const promptMsg = await interaction.editReply({ embeds: [promptEmbed], components: [promptRow] });

        // Await button click for configuration (Ephemeral component collector)
        const filter = i => i.user.id === interaction.user.id && ['auto_conf', 'manual_conf'].includes(i.customId);
        try {
          const response = await promptMsg.awaitMessageComponent({ filter, time: 60000 });
          
          if (response.customId === 'auto_conf') {
            await response.deferUpdate();
            try {
              const everyone = interaction.guild.roles.everyone;
              await everyone.setPermissions(everyone.permissions.remove(PermissionFlagsBits.ViewChannel));
              await role.setPermissions(role.permissions.add(PermissionFlagsBits.ViewChannel));
              await interaction.channel.permissionOverwrites.edit(everyone, { ViewChannel: true });
              
              await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x00FF00).setTitle('<:status_jtc:1524089009163337758> Auto-Configuration Complete').setDescription('The server is now securely locked behind the verification gate.')], components: [] });
            } catch (err) {
              await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('<:reject_jtc:1524118914525827072> Configuration Failed').setDescription(`I do not have enough permissions to modify server roles or channel overwrites.\n\n\`${err.message}\``)], components: [] });
            }
          } else {
            await response.update({ embeds: [new EmbedBuilder().setColor(0x2b2d31).setTitle('<:info_jtc:1524111455404953663> Manual Configuration').setDescription(`You chose to do it manually. Please remember to restrict \`@everyone\` and allow ${role} to view channels.`)], components: [] });
          }
        } catch (e) {
          // Timeout
          await interaction.editReply({ components: [] }).catch(() => null);
        }
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
        
        await interaction.editReply(cv2.success('Verification Disabled', 'The verification system has been disabled and the panel was removed.'));
      }
    }
  }
];
