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
            description: 'The role ID or mention to grant upon verification',
            type: 3, // STRING
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
        // Public visible reply
        await interaction.deferReply();
        
        const roleOption = interaction.options.get('role');
        let role = null;
        
        if (roleOption?.role) {
          role = roleOption.role;
        } else if (roleOption?.value && typeof roleOption.value === 'string') {
          const roleInput = roleOption.value.replace(/[<@&>]/g, '');
          role = interaction.guild.roles.cache.get(roleInput);
        }
        
        if (!role) {
          return interaction.editReply(cv2.danger('Role Not Found', 'Could not find a valid role. Make sure to provide a valid Role ID or mention.'));
        }
        
        // Ensure the bot can manage the role
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
          return interaction.editReply(cv2.danger('Permission Error', `I cannot assign ${role} because it is higher than or equal to my highest role!`));
        }

        const rawPayload = {
          content: "",
          components: [
            {
              type: 17, // ContainerBuilder
              components: [{"type":10,"content":"## **System Authentication**\\n\\n-# **Welcome to the server! Access to standard channels is currently restricted.**\\n-# **To gain entry, you must verify your identity by clicking the authentication button below.**\\n\\n<:info_jtc:1524111455404953663> **__Authentication Details__**\\n-# **\\u2022 Account verification prevents automated bot raids.**\\n-# **\\u2022 Ensure your DMs are open to receive status updates.**\\n-# **\\u2022 Failure to authenticate may result in removal.**"}]
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

        const promptPayload = {
          content: "",
          components: [
            {
              type: 17,
              components: [
    {
      type: 10,
      content: `## **Verification Panel Deployed!**\n\n-# **The panel is live. Users clicking the button will now receive ${role}.**\n\n**Would you like Athena Prime to automatically configure the server permissions for you?**\n\n-# **If you select Auto-Configure, I will:**\n-# **• Disable \`View Channels\` globally for \`@everyone\`.**\n-# **• Enable \`View Channels\` globally for the ${role} role.**\n-# **• Make sure this verification channel remains visible to everyone.**\n\n-# **Note: Channels used in Discord Onboarding or Community Rules have forced visibility. Their visibility cannot be hidden from @everyone due to Discord restrictions.**`
    },
    { type: 14, divider: true },
    { type: 10, content: '-# **Athena Bulletproof Security !!!**' }
  ]
            },
            {
              type: 1,
              components: [
                { type: 2, custom_id: 'auto_conf', label: 'Auto-Configure', style: 3 }, // 3 is Success (Green)
                { type: 2, custom_id: 'manual_conf', label: 'I\'ll do it manually', style: 2 } // 2 is Secondary (Grey)
              ]
            }
          ],
          flags: 32768
        };

        const promptMsg = await interaction.editReply(promptPayload);

        // Await button click for configuration (Component collector)
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
              
              const rulesChannel = interaction.guild.rulesChannelId;
              const publicUpdatesChannel = interaction.guild.publicUpdatesChannelId;
              let forcedIds = [rulesChannel, publicUpdatesChannel].filter(Boolean);
              
              try {
                const onboarding = await interaction.guild.onboarding.fetch().catch(() => null);
                if (onboarding && onboarding.enabled) {
                  forcedIds.push(...onboarding.defaultChannelIds);
                }
              } catch(e) {}
              
              forcedIds = [...new Set(forcedIds)]; // Remove duplicates
              const allMentions = forcedIds.map(id => `<#${id}>`);
              
              let channelsText = "";
              if (allMentions.length > 0) {
                const displayChannels = allMentions.slice(0, 15).join(' ');
                const extra = allMentions.length > 15 ? ` and ${allMentions.length - 15} more...` : '';
                channelsText = `\n\n-# **Note: The following channels have forced visibility due to Discord Onboarding or Community settings and cannot be hidden from @everyone:**\n-# **${displayChannels}${extra}**`;
              } else {
                channelsText = `\n\n-# **Note: Channels used in Discord Onboarding or Community Rules have forced visibility. Their visibility cannot be hidden from @everyone due to Discord restrictions.**`;
              }
              
              const successPayload = {
                content: "",
                components: [{ type: 17, components: [
  { type: 10, content: `## **Auto-Configuration Complete**\n\n-# **The server is now securely locked behind the verification gate.**${channelsText}` },
  { type: 14, divider: true },
  { type: 10, content: '-# **Athena Bulletproof Security !!!**' }
] }],
                flags: 32768
              };
              await interaction.editReply(successPayload);
            } catch (err) {
              const errorPayload = {
                content: "",
                components: [{ type: 17, components: [
  { type: 10, content: `## **Configuration Failed**\n\n-# **I do not have enough permissions to modify server roles or channel overwrites.**\n-# **\`${err.message}\`**` },
  { type: 14, divider: true },
  { type: 10, content: '-# **Athena Bulletproof Security !!!**' }
] }],
                flags: 32768
              };
              await interaction.editReply(errorPayload);
            }
          } else {
            const manualPayload = {
              content: "",
              components: [{ type: 17, components: [
  { type: 10, content: `## **Manual Configuration**\n\n-# **You chose to do it manually. Please remember to restrict \`@everyone\` and allow ${role} to view channels.**` },
  { type: 14, divider: true },
  { type: 10, content: '-# **Athena Bulletproof Security !!!**' }
] }],
              flags: 32768
            };
            await response.update(manualPayload);
          }
        } catch (e) {
          // Timeout - strip buttons
          promptPayload.components.pop();
          await interaction.editReply(promptPayload).catch(() => null);
        }

      } 
      
      else if (subcommand === 'disable') {
        // Public visible reply
        await interaction.deferReply();
        
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

        // Restore permissions
        try {
          const everyone = interaction.guild.roles.everyone;
          await everyone.setPermissions(everyone.permissions.add(PermissionFlagsBits.ViewChannel));
        } catch(e) {}

        db.deleteVerification(guildId);
        
        const disablePayload = {
          content: "",
          components: [
            {
              type: 17,
              components: [
    {
      type: 10,
      content: `## **Verification Disabled**\n\n-# **The verification system has been disabled and the panel was removed.**\n-# **• Server visibility permissions have been restored for @everyone.**`
    },
    { type: 14, divider: true },
    { type: 10, content: '-# **Athena Bulletproof Security !!!**' }
  ]
            }
          ],
          flags: 32768
        };
        await interaction.editReply(disablePayload);
      }
    }
  }
];
