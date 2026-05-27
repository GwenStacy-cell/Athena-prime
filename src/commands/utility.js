import { PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

export const commands = [
  // --- HELP COMMAND ---
  {
    name: 'help',
    description: 'Lists all available security and moderation commands.',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      const result = await getHelpEmbed(message.guild);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const result = await getHelpEmbed(interaction.guild);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- PING COMMAND ---
  {
    name: 'ping',
    description: 'Checks the bot and gateway latency.',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      const response = await message.reply('Pinging WebSocket...');
      const pingMs = response.createdTimestamp - message.createdTimestamp;
      const apiMs = Math.round(message.client.ws.ping);
      
      const pingEmbed = embed.info(
        'Pong! Latency Report',
        `📡 Gateway Connection details:`,
        [
          { name: 'Bot Latency', value: `\`${pingMs}ms\``, inline: true },
          { name: 'Discord API Gateway', value: `\`${apiMs}ms\``, inline: true }
        ]
      );
      await response.edit({ content: null, embeds: [pingEmbed] });
    },
    async executeSlash(interaction) {
      const sent = await interaction.reply({ content: 'Pinging WebSocket...', fetchReply: true });
      const pingMs = sent.createdTimestamp - interaction.createdTimestamp;
      const apiMs = Math.round(interaction.client.ws.ping);

      const pingEmbed = embed.info(
        'Pong! Latency Report',
        `📡 Gateway Connection details:`,
        [
          { name: 'Bot Latency', value: `\`${pingMs}ms\``, inline: true },
          { name: 'Discord API Gateway', value: `\`${apiMs}ms\``, inline: true }
        ]
      );
      await interaction.editReply({ content: null, embeds: [pingEmbed] });
    }
  },

  // --- SETUP COMMAND ---
  {
    name: 'setup',
    description: 'Configures bot logs channel, mute roles, or settings.',
    category: 'utility',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'logchannel',
        description: 'Designate the text channel for security logs',
        type: 7, // Channel
        required: false
      },
      {
        name: 'quarantinerole',
        description: 'Designate an existing role as the Quarantine role',
        type: 8, // Role
        required: false
      }
    ],
    async executePrefix(message) {
      const channel = message.mentions.channels.first();
      const role = message.mentions.roles.first();

      if (!channel && !role) {
        return message.reply({ embeds: [embed.warn('Setup Info', 'Usage: `!setup <#logChannel>` or `!setup <@quarantineRole>`')] });
      }

      const result = await handleSetup(message.guild, channel, role);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const channel = interaction.options.getChannel('logchannel');
      const role = interaction.options.getRole('quarantinerole');

      if (!channel && !role) {
        return interaction.reply({ embeds: [embed.warn('Setup Help', 'Specify a channel or a role parameter to update.')], ephemeral: true });
      }

      const result = await handleSetup(interaction.guild, channel, role);
      await interaction.reply({ embeds: [result.embed] });
    }
  }
];

// ==========================================
// HELPERS
// ==========================================

async function getHelpEmbed(guild) {
  const config = db.getGuildConfig(guild.id);
  const p = config.prefix;

  const fields = [
    {
      name: '🛡️ Security & Anti-Raid',
      value: 
        `\`${p}quarantine <@user> [reason]\` / \`/quarantine\` - Strips roles & isolates member.\n` +
        `\`${p}unquarantine <@user>\` / \`/unquarantine\` - Restores member's original roles.\n` +
        `\`${p}lockdown [on/off]\` / \`/lockdown\` - Locks or unlocks writing in channel.\n` +
        `\`${p}raidmode [on/off]\` / \`/raidmode\` - Autolocks server (auto-quarantines new joins).\n`
    },
    {
      name: '🔨 Moderation Commands',
      value: 
        `\`${p}muteall [text|voice]\` / \`/muteall\` - Mute text channel or voice members.\n` +
        `\`${p}unmuteall [text|voice]\` / \`/unmuteall\` - Unmute text channel or voice members.\n` +
        `\`${p}warn <@user> <reason>\` / \`/warn\` - Warm member. DM alert. 3 warns = auto-quarantine.\n` +
        `\`${p}warnings <@user>\` / \`/warnings\` - View user's warnings history.\n` +
        `\`${p}clearwarns <@user>\` / \`/clearwarns\` - Clear user warnings.\n` +
        `\`${p}timeout <@user> <duration> [reason]\` / \`/timeout\` - Places user on timeout.\n` +
        `\`${p}kick <@user> [reason]\` / \`/kick\` - Kicks user from guild.\n` +
        `\`${p}ban <@user> [reason]\` / \`/ban\` - Bans user permanently.\n`
    },
    {
      name: '⚙️ Utilities',
      value: 
        `\`${p}setup\` - Configure security parameters manually.\n` +
        `\`${p}ping\` - Check latency metrics.\n` +
        `\`${p}help\` - Displays this detailed reference menu.`
    }
  ];

  const helpEmbed = embed.info(
    'Sentinel Security Bot - Commands Hub',
    `Welcome to the advanced Security Panel. All commands are supported as **both** traditional text prefixes and modern Slash interactions.`,
    fields
  );
  
  return { embed: helpEmbed };
}

async function handleSetup(guild, channel, role) {
  const updates = {};
  const fields = [];

  if (channel) {
    updates.logChannel = channel.id;
    fields.push({ name: 'Security Logs Channel', value: `${channel} (ID: ${channel.id})` });
  }

  if (role) {
    updates.quarantineRoleId = role.id;
    fields.push({ name: 'Quarantine Role', value: `${role} (ID: ${role.id})` });
  }

  db.updateGuildConfig(guild.id, updates);

  const resEmbed = embed.success(
    'Configuration Updated',
    'Successfully saved server adjustments to database cache.',
    fields
  );

  return { embed: resEmbed };
}
