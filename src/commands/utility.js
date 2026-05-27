import { PermissionFlagsBits, ChannelType } from 'discord.js';
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
          { name: 'Bot Latency', value: `**${pingMs}ms**`, inline: true },
          { name: 'Discord API Gateway', value: `**${apiMs}ms**`, inline: true }
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
          { name: 'Bot Latency', value: `**${pingMs}ms**`, inline: true },
          { name: 'Discord API Gateway', value: `**${apiMs}ms**`, inline: true }
        ]
      );
      await interaction.editReply({ content: null, embeds: [pingEmbed] });
    }
  },

  // --- SETUP COMMAND ---
  {
    name: 'setup',
    description: 'Configures bot logs channel, quarantine voice, or settings.',
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
        name: 'quarantinevc',
        description: 'Designate the Voice Channel for isolating quarantined users',
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
    async executePrefix(message, args) {
      const channel = message.mentions.channels.first();
      const role = message.mentions.roles.first();
      
      // Resolve first mentioned or matched voice channel in args
      const voiceChannel = message.guild.channels.cache.find(
        c => c.type === ChannelType.GuildVoice && 
        args.some(arg => arg.includes(c.id) || arg.toLowerCase() === c.name.toLowerCase())
      );

      if (!channel && !role && !voiceChannel) {
        return message.reply({ embeds: [embed.warn('Setup Info', 'Usage: `!setup <#logChannel>` or `!setup <quarantineVoiceChannelName>` or `!setup <@quarantineRole>`')] });
      }

      const result = await handleSetup(message.guild, channel, role, voiceChannel);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const channel = interaction.options.getChannel('logchannel');
      const voiceChannel = interaction.options.getChannel('quarantinevc');
      const role = interaction.options.getRole('quarantinerole');

      if (channel && channel.type !== ChannelType.GuildText) {
        return interaction.reply({ embeds: [embed.warn('Command Error', 'Logs channel must be a text channel.')], ephemeral: true });
      }
      if (voiceChannel && voiceChannel.type !== ChannelType.GuildVoice) {
        return interaction.reply({ embeds: [embed.warn('Command Error', 'Quarantine VC must be a voice channel.')], ephemeral: true });
      }

      const result = await handleSetup(interaction.guild, channel, role, voiceChannel);
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
      name: '🛡️ Security & Hyper-Defense Shield',
      value: 
        `\`${p}antinuke <enable all|disable all|config>\` - Toggle all shields, or launch **button panel config**!\n` +
        `\`${p}quarantine <@user> [reason]\` / \`/quarantine\` - Strips roles & isolates target in text/voice VC.\n` +
        `\`${p}unquarantine <@user>\` / \`/unquarantine\` - Recovers target roles & moves to previous Voice VC.\n` +
        `\`${p}whitelist <add|remove|list> [user]\` - Manage whitelisted admins (immune to nuke/spam/filters).\n` +
        `\`${p}blacklist <add|remove|list> [phrase]\` - Manage blacklisted words (purges & warns automatically).\n` +
        `\`${p}autonick <on|off> [prefix] [suffix]\` - Auto-format nicknames of newly joining members.\n` +
        `\`${p}lockdown [on|off]\` / \`/lockdown\` - Toggle writing restrictions for everyone in text channel.\n` +
        `\`${p}raidmode [on|off]\` / \`/raidmode\` - Auto-isolate joining members immediately.`
    },
    {
      name: '🔨 Moderation & Server Management',
      value: 
        `\`${p}say <#channel> <message>\` - Dispatches bot raw text messages.\n` +
        `\`${p}announce <#channel> <title> | <message>\` - Publishes styled announcement card embeds.\n` +
        `\`${p}createrole <name> [color]\` - Creates server role with specific color code.\n` +
        `\`${p}deleterole <@role>\` - Safely deletes role from server.\n` +
        `\`${p}muteall [text|voice]\` / \`/muteall\` - Locks writing or mutes voice VC members.\n` +
        `\`${p}unmuteall [text|voice]\` / \`/unmuteall\` - Restores chat or unmutes voice VC members.\n` +
        `\`${p}warn <@user> <reason>\` - Warm target in active chat (3 warns = auto quarantine).\n` +
        `\`${p}warnings <@user>\` / \`clearwarns <@user>\` - View or wipe warnings histories.\n` +
        `\`${p}timeout <@user> <dur> [reason]\` / \`kick <@user>\` / \`ban <@user>\` - Timeout/Kick/Ban target.`
    },
    {
      name: '⚙️ Utilities',
      value: 
        `\`${p}setup [logchannel] [quarantinevc] [quarantinerole]\` - Dynamic bindings configurations.\n` +
        `\`ping\` / \`${p}ping\` - Latencies checks (Prefix-less supported, bold speed MS).\n` +
        `\`${p}help\` - Displays this comprehensive commands console.`
    }
  ];

  const helpEmbed = embed.info(
    'Medusa Prime - Help Commands Console',
    `Welcome to the Medusa Hyper-Defense hub. All commands are supported as **both** traditional text prefixes and modern Slash interactions.`,
    fields
  );
  
  return { embed: helpEmbed };
}

async function handleSetup(guild, channel, role, voiceChannel) {
  const updates = {};
  const fields = [];

  if (channel) {
    updates.logChannel = channel.id;
    fields.push({ name: 'Security Logs Channel', value: `${channel} (ID: ${channel.id})` });
  }

  if (voiceChannel) {
    updates.quarantineVcId = voiceChannel.id;
    fields.push({ name: 'Quarantine Voice Channel', value: `${voiceChannel} (ID: ${voiceChannel.id})` });
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
