import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { generateAIResponse, formatAIToGreyMarkdown } from '../utils/ai.js';

/**
 * Builds an accent borderless CV2 container for Athena AI responses
 */
export function buildAICV2Container(user, prompt, aiResult, accentColor = '#00e5ff') {
  const content = formatAIToGreyMarkdown(aiResult.text || 'No response generated.');
  const comps = [
    {
      type: 10,
      content:
        `### **Athena Prime Neural Engine** | <a:uptime:1552608831060844575>\n` +
        `-# **• Member:** <@${user.id}> \`(${user.id})\` \u00b7 **Model:** \`${aiResult.model}\` \u00b7 **Latency:** \`${aiResult.latencyMs}ms\`\n` +
        `-# **• Prompt:** *${prompt.length > 120 ? prompt.slice(0, 117) + '...' : prompt}*`
    },
    { type: 14, divider: true }
  ];

  // Discord component text limit is ~4000 characters. Split if needed.
  if (content.length <= 3800) {
    comps.push({ type: 10, content });
  } else {
    const chunks = content.match(/[\s\S]{1,3800}/g) || [content];
    for (let i = 0; i < chunks.length; i++) {
      comps.push({ type: 10, content: chunks[i] });
      if (i < chunks.length - 1) comps.push({ type: 14, divider: true });
    }
  }

  comps.push({ type: 14, divider: true });
  comps.push({
    type: 10,
    content: `-# **Athena Intelligence Matrix \u00b7 Accelerated Neural Core \u00b7 V2.5**`
  });

  return {
    type: 17,
    components: comps
  };
}

export const commands = [
  // --- ASK COMMAND ---
  {
    name: 'ask',
    description: 'Query the Athena Prime Neural AI Engine for answers, analysis, and assistance.',
    category: 'utility',
    aliases: ['ai', 'athena', 'neural', 'gemini'],
    options: [
      {
        name: 'prompt',
        description: 'Your question or prompt for Athena AI',
        type: 3, // STRING
        required: true
      }
    ],
    async executePrefix(message, args) {
      const prompt = args.join(' ').trim();
      if (!prompt) {
        return message.reply({
          components: [
            cv2.buildContainer(
              'Athena Neural Engine',
              'Please provide a question or instruction to query Athena AI.\n\n-# **Usage:** `!ask <your question>` or `/ask <prompt>`'
            )
          ],
          flags: MessageFlags.IsComponentsV2
        });
      }

      const cfg = db.getGuildConfig(message.guild?.id || '0');
      const accentColor = cfg?.accentColor || '#00e5ff';

      const thinkingMsg = await message.reply({
        content: '-# <a:uptime:1552608831060844575> **Athena Neural Engine is synthesizing response...**'
      }).catch(() => null);

      const aiResult = await generateAIResponse(prompt, {
        guildId: message.guild?.id,
        userTag: message.author.tag,
        serverName: message.guild?.name
      });

      if (!aiResult.success) {
        const errorContainer = {
          type: 17,
          components: [
            {
              type: 10,
              content:
                `### **Neural Engine Advisory** | <a:uptime:1552608831060844575>\n` +
                `-# **• Status:** \`Failed to synthesize\`\n` +
                `-# **• Error:** ${aiResult.error || 'Connection timed out'}`
            }
          ]
        };
        if (thinkingMsg) {
          await thinkingMsg.delete().catch(() => null);
        }
        return message.reply({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {
          return message.channel.send({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 });
        });
      }

      const container = buildAICV2Container(message.author, prompt, aiResult, accentColor);
      if (thinkingMsg) {
        await thinkingMsg.delete().catch(() => null);
      }
      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {
        return message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
      });
    },

    async executeSlash(interaction) {
      await interaction.deferReply();
      const prompt = interaction.options.getString('prompt');
      const cfg = db.getGuildConfig(interaction.guild?.id || '0');
      const accentColor = cfg?.accentColor || '#00e5ff';

      const aiResult = await generateAIResponse(prompt, {
        guildId: interaction.guild?.id,
        userTag: interaction.user.tag,
        serverName: interaction.guild?.name
      });

      if (!aiResult.success) {
        const errorContainer = {
          type: 17,
          components: [
            {
              type: 10,
              content:
                `### **Neural Engine Advisory** | <a:uptime:1552608831060844575>\n` +
                `-# **• Status:** \`Failed to synthesize\`\n` +
                `-# **• Error:** ${aiResult.error || 'Connection timed out'}`
            }
          ]
        };
        return interaction.editReply({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 });
      }

      const container = buildAICV2Container(interaction.user, prompt, aiResult, accentColor);
      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
  },

  // --- AIMODE COMMAND ---
  {
    name: 'aimode',
    description: 'Configure server AI assistant mode and dedicated AI interaction channels.',
    category: 'utility',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'status',
        description: 'View current AI assistant mode status',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'toggle',
        description: 'Enable or disable conversational AI mode',
        type: 1,
        options: [
          {
            name: 'state',
            description: 'Turn AI mode on or off',
            type: 3,
            required: true,
            choices: [
              { name: 'Enable (ON)', value: 'on' },
              { name: 'Disable (OFF)', value: 'off' }
            ]
          }
        ]
      },
      {
        name: 'channel',
        description: 'Set or clear the dedicated AI conversation channel',
        type: 1,
        options: [
          {
            name: 'target',
            description: 'The channel for AI conversations (leave empty to unbind)',
            type: 7, // CHANNEL
            required: false
          }
        ]
      }
    ],
    async executePrefix(message, args) {
      const guildId = message.guild.id;
      const cfg = db.getGuildConfig(guildId) || {};
      const sub = (args[0] || '').toLowerCase();

      if (sub === 'on' || sub === 'enable') {
        db.updateGuildConfig(guildId, { aiModeEnabled: true });
        return message.reply({
          components: [
            cv2.buildContainer(
              'AI Mode Activated | <a:atheNATICK:1557841381630681106>',
              'Conversational AI mode has been enabled. Set a dedicated channel with `!aimode channel #channel`.'
            )
          ],
          flags: MessageFlags.IsComponentsV2
        });
      }

      if (sub === 'off' || sub === 'disable') {
        db.updateGuildConfig(guildId, { aiModeEnabled: false });
        return message.reply({
          components: [
            cv2.buildContainer(
              'AI Mode Disabled | <a:atheNATICK:1557841381630681106>',
              'AI replies are now strictly restricted to the `!ask` command.'
            )
          ],
          flags: MessageFlags.IsComponentsV2
        });
      }

      if (sub === 'channel') {
        const channelMention = message.mentions.channels.first() || (args[1] ? message.guild.channels.cache.get(args[1]) : null);
        if (!channelMention) {
          db.updateGuildConfig(guildId, { aiChannelId: null });
          return message.reply({
            components: [
              cv2.buildContainer(
                'AI Channel Unbound | <a:atheNATICK:1557841381630681106>',
                'The dedicated AI channel binding has been removed. AI replies are now strictly restricted to `!ask`.'
              )
            ],
            flags: MessageFlags.IsComponentsV2
          });
        }
        db.updateGuildConfig(guildId, { aiModeEnabled: true, aiChannelId: channelMention.id });
        return message.reply({
          components: [
            cv2.buildContainer(
              'AI Channel Bound | <a:atheNATICK:1557841381630681106>',
              `Athena AI will now converse automatically with members in <#${channelMention.id}>.\nAll responses will be formatted in accent borderless CV2 containers.`
            )
          ],
          flags: MessageFlags.IsComponentsV2
        });
      }

      // Default: Status
      const isEnabled = Boolean(cfg.aiModeEnabled);
      const chId = cfg.aiChannelId;
      const statusText =
        `-# • **System Status:** \`${isEnabled ? 'ACTIVE' : 'STANDBY'}\`\n` +
        `-# • **Dedicated Channel:** ${chId ? `<#${chId}> (\`${chId}\`)` : '`None (Restricted to !ask only)`'}\n` +
        `-# • **Container Styling:** \`Accent Borderless CV2 Container\`\n\n` +
        `-# **Commands:**\n` +
        `-# • \`!ask <prompt>\` - Direct query to Athena Neural Engine\n` +
        `-# • \`!aimode on / off\` - Toggle conversational mode\n` +
        `-# • \`!aimode channel #channel\` - Bind dedicated AI chat channel`;

      return message.reply({
        components: [
          cv2.buildContainer('Athena AI Architecture Status | <a:atheNATICK:1557841381630681106>', statusText)
        ],
        flags: MessageFlags.IsComponentsV2
      });
    },

    async executeSlash(interaction) {
      const guildId = interaction.guild.id;
      const cfg = db.getGuildConfig(guildId) || {};
      const sub = interaction.options.getSubcommand();

      if (sub === 'toggle') {
        const state = interaction.options.getString('state') === 'on';
        db.updateGuildConfig(guildId, { aiModeEnabled: state });
        return interaction.reply({
          components: [
            cv2.buildContainer(
              `AI Mode ${state ? 'Activated' : 'Disabled'} | <a:atheNATICK:1557841381630681106>`,
              state
                ? 'Conversational AI mode has been enabled. Set a channel with `/aimode channel`.'
                : 'AI replies are now strictly restricted to `/ask`.'
            )
          ],
          flags: MessageFlags.IsComponentsV2
        });
      }

      if (sub === 'channel') {
        const target = interaction.options.getChannel('target');
        if (!target) {
          db.updateGuildConfig(guildId, { aiChannelId: null });
          return interaction.reply({
            components: [
              cv2.buildContainer(
                'AI Channel Unbound | <a:atheNATICK:1557841381630681106>',
                'The dedicated AI channel binding has been removed.'
              )
            ],
            flags: MessageFlags.IsComponentsV2
          });
        }
        db.updateGuildConfig(guildId, { aiModeEnabled: true, aiChannelId: target.id });
        return interaction.reply({
          components: [
            cv2.buildContainer(
              'AI Channel Bound | <a:atheNATICK:1557841381630681106>',
              `Athena AI will now converse automatically with members in <#${target.id}>.`
            )
          ],
          flags: MessageFlags.IsComponentsV2
        });
      }

      // Status
      const isEnabled = Boolean(cfg.aiModeEnabled);
      const chId = cfg.aiChannelId;
      const statusText =
        `-# • **System Status:** \`${isEnabled ? 'ACTIVE' : 'STANDBY'}\`\n` +
        `-# • **Dedicated Channel:** ${chId ? `<#${chId}>` : '`None (Restricted to /ask only)`'}\n` +
        `-# • **Container Styling:** \`Accent Borderless CV2 Container\``;

      return interaction.reply({
        components: [
          cv2.buildContainer('Athena AI Architecture Status | <a:atheNATICK:1557841381630681106>', statusText)
        ],
        flags: MessageFlags.IsComponentsV2
      });
    }
  }
];

export default commands;
