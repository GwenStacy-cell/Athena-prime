import { PermissionFlagsBits, ChannelType } from 'discord.js';
import embed from '../embed.js';
import { isBotOwnerSync, isExtraOwner, isAuthorized } from '../utils/helpers.js';

// ============================================================
// ACTIVE DRAG SESSIONS — keyed by `${guildId}:${targetUserId}`
// Holds the interval reference so it can be cleared by /vcdragstop
// ============================================================
const activeDrags = new Map();

export const commands = [
  // ─────────────────────────────────────────────
  // /vcdrag  —  Start dragging a user across VCs
  // ─────────────────────────────────────────────
  {
    name: 'vcdrag',
    description: 'Drags a user across every voice channel in an endless loop until /vcdragstop.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.MoveMembers],
    options: [
      {
        name: 'user',
        description: 'The member to drag across voice channels',
        type: 6,   // USER
        required: true
      },
      {
        name: 'interval',
        description: 'Seconds between each move (default: 2, min: 1, max: 30)',
        type: 4,   // INTEGER
        required: false,
        min_value: 1,
        max_value: 30
      }
    ],

    async executePrefix(message, args) {
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({
          embeds: [embed.warn('Command Error',
            `${message.author} Please mention a valid member.\n\n**Usage:** \`!vcdrag <@user> [interval_seconds]\``)]
        });
      }
      const intervalSec = parseInt(args[1]) || 2;
      const result = await handleVcDrag(message.guild, message.member, target, intervalSec);
      await message.reply({ embeds: [result.embed] });
    },

    async executeSlash(interaction) {
      await interaction.deferReply();
      const targetUser = interaction.options.getUser('user');
      const intervalSec = interaction.options.getInteger('interval') ?? 2;

      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) {
        return interaction.editReply({
          embeds: [embed.warn('Command Error', `${interaction.user} Member not found in this server.`)]
        });
      }

      const result = await handleVcDrag(interaction.guild, interaction.member, target, intervalSec);
      await interaction.editReply({ embeds: [result.embed] });
    }
  },

  // ─────────────────────────────────────────────
  // /vcdragstop  —  Stop an active drag session
  // ─────────────────────────────────────────────
  {
    name: 'vcdragstop',
    description: 'Stops an active /vcdrag session for a user.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.MoveMembers],
    options: [
      {
        name: 'user',
        description: 'The member whose drag session to stop',
        type: 6,   // USER
        required: true
      }
    ],

    async executePrefix(message) {
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({
          embeds: [embed.warn('Command Error',
            `${message.author} Please mention the member whose drag session you want to stop.\n\n**Usage:** \`!vcdragstop <@user>\``)]
        });
      }
      const result = handleVcDragStop(message.guild, message.member, target);
      await message.reply({ embeds: [result.embed] });
    },

    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) {
        return interaction.reply({
          embeds: [embed.warn('Command Error', `${interaction.user} Member not found.`)],
          ephemeral: true
        });
      }
      const result = handleVcDragStop(interaction.guild, interaction.member, target);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // ─────────────────────────────────────────────
  // /vcdraglist  —  See all active drag sessions
  // ─────────────────────────────────────────────
  {
    name: 'vcdraglist',
    description: 'Lists all currently active VC drag sessions in this server.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.MoveMembers],
    options: [],

    async executePrefix(message) {
      const result = handleVcDragList(message.guild);
      await message.reply({ embeds: [result.embed] });
    },

    async executeSlash(interaction) {
      const result = handleVcDragList(interaction.guild);
      await interaction.reply({ embeds: [result.embed], ephemeral: true });
    }
  },

  // ─────────────────────────────────────────────
  // /massdc  —  Mass Disconnect users from a VC
  // ─────────────────────────────────────────────
  {
    name: 'massdc',
    description: '[OWNER ONLY] Disconnects all users from a voice channel (you are immune).',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'channel',
        description: 'The voice channel to clear (defaults to your current channel)',
        type: 7, // CHANNEL
        channel_types: [ChannelType.GuildVoice, ChannelType.GuildStageVoice],
        required: false
      }
    ],
    async executePrefix(message, args) {
      if (!(await isAuthorized(message.author, message.guild))) {
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} Only the **Bot Owner**, **Server Owner**, and **Extra Owners** can use mass commands.`)] });
      }

      let targetVc;
      if (args[0]) {
        targetVc = message.guild.channels.cache.get(args[0].replace(/[<#>]/g, '')) || 
                   message.guild.channels.cache.find(c => (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && c.name.toLowerCase().includes(args.join(' ').toLowerCase()));
      } else {
        targetVc = message.member.voice.channel;
      }

      if (!targetVc || (targetVc.type !== ChannelType.GuildVoice && targetVc.type !== ChannelType.GuildStageVoice)) {
        return message.reply({ embeds: [embed.warn('Channel Not Found', 'Please specify a valid voice channel, or join one first.')] });
      }

      const result = await handleMassDisconnect(targetVc, message.member);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} Only the **Bot Owner**, **Server Owner**, and **Extra Owners** can use mass commands.`)], ephemeral: true });
      }

      const targetVc = interaction.options.getChannel('channel') || interaction.member.voice.channel;

      if (!targetVc || (targetVc.type !== ChannelType.GuildVoice && targetVc.type !== ChannelType.GuildStageVoice)) {
        return interaction.reply({ embeds: [embed.warn('Channel Not Found', 'Please specify a valid voice channel, or join one first.')], ephemeral: true });
      }

      const result = await handleMassDisconnect(targetVc, interaction.member);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // ─────────────────────────────────────────────
  // /massmove  —  Mass Move users to another VC
  // ─────────────────────────────────────────────
  {
    name: 'massmove',
    description: '[OWNER ONLY] Moves all users from one voice channel to another.',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'destination',
        description: 'The voice channel to move everyone to',
        type: 7, // CHANNEL
        channel_types: [ChannelType.GuildVoice, ChannelType.GuildStageVoice],
        required: true
      },
      {
        name: 'source',
        description: 'The channel to pull users from (defaults to your current channel)',
        type: 7, // CHANNEL
        channel_types: [ChannelType.GuildVoice, ChannelType.GuildStageVoice],
        required: false
      }
    ],
    async executePrefix(message, args) {
      if (!(await isAuthorized(message.author, message.guild))) {
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} Only the **Bot Owner**, **Server Owner**, and **Extra Owners** can use mass commands.`)] });
      }

      if (!args[0]) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Usage: `!massmove <destination>` or `!massmove <source> <destination>`')] });
      }

      let sourceVc = message.member.voice.channel;
      let destVc;

      // If two args provided, try to resolve both
      if (args.length >= 2) {
        const potentialSource = message.guild.channels.cache.get(args[0].replace(/[<#>]/g, ''));
        if (potentialSource && (potentialSource.type === ChannelType.GuildVoice || potentialSource.type === ChannelType.GuildStageVoice)) {
          sourceVc = potentialSource;
          const destQuery = args.slice(1).join(' ').toLowerCase();
          destVc = message.guild.channels.cache.get(destQuery.replace(/[<#>]/g, '')) || 
                   message.guild.channels.cache.find(c => (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && c.name.toLowerCase().includes(destQuery));
        } else {
          // Just one arg technically, resolving destination
          const destQuery = args.join(' ').toLowerCase();
          destVc = message.guild.channels.cache.get(destQuery.replace(/[<#>]/g, '')) || 
                   message.guild.channels.cache.find(c => (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && c.name.toLowerCase().includes(destQuery));
        }
      } else {
        const destQuery = args.join(' ').toLowerCase();
        destVc = message.guild.channels.cache.get(destQuery.replace(/[<#>]/g, '')) || 
                 message.guild.channels.cache.find(c => (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && c.name.toLowerCase().includes(destQuery));
      }

      if (!sourceVc) return message.reply({ embeds: [embed.warn('Source Not Found', 'You must be in a voice channel, or specify a source channel.')] });
      if (!destVc) return message.reply({ embeds: [embed.warn('Destination Not Found', 'Could not find the destination voice channel.')] });

      const result = await handleMassMove(sourceVc, destVc, message.member);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} Only the **Bot Owner**, **Server Owner**, and **Extra Owners** can use mass commands.`)], ephemeral: true });
      }

      const destVc = interaction.options.getChannel('destination');
      const sourceVc = interaction.options.getChannel('source') || interaction.member.voice.channel;

      if (!sourceVc) return interaction.reply({ embeds: [embed.warn('Source Not Found', 'You must be in a voice channel, or specify a source channel.')], ephemeral: true });
      
      const result = await handleMassMove(sourceVc, destVc, interaction.member);
      await interaction.reply({ embeds: [result.embed] });
    }
  }
];

// =============================================================
// CORE LOGIC
// =============================================================

async function handleVcDrag(guild, moderator, target, intervalSec) {
  // — Permission & safety checks ——————————————————————————

  // Bot owner & extra owners are immune
  if (isBotOwnerSync(target.id) || isExtraOwner(guild.id, target.id)) {
    return {
      embed: embed.danger(
        '👑 Untouchable',
        `🛡️ **${target.user.tag}** is protected by Athena Prime and cannot be dragged.`
      )
    };
  }

  // Target must currently be in a voice channel
  if (!target.voice.channel) {
    return {
      embed: embed.warn(
        'VC Drag Failed',
        `${target} is not currently in any voice channel. Ask them to join one first.`
      )
    };
  }

  // Bot needs Move Members permission
  const botMember = guild.members.me;
  if (!botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
    return {
      embed: embed.danger(
        'Missing Permission',
        'I need the **Move Members** permission to drag users between voice channels.'
      )
    };
  }

  const sessionKey = `${guild.id}:${target.id}`;

  // Kill any pre-existing session for this user
  if (activeDrags.has(sessionKey)) {
    clearInterval(activeDrags.get(sessionKey).timer);
    activeDrags.delete(sessionKey);
  }

  // — Collect all usable VCs ————————————————————————————————
  const getVoiceChannels = () =>
    guild.channels.cache
      .filter(c =>
        c.type === ChannelType.GuildVoice &&
        c.permissionsFor(botMember).has(PermissionFlagsBits.MoveMembers) &&
        c.permissionsFor(botMember).has(PermissionFlagsBits.Connect)
      )
      .map(c => c);

  let vcList = getVoiceChannels();

  if (vcList.length < 2) {
    return {
      embed: embed.warn(
        'Not Enough VCs',
        'There must be at least **2 voice channels** accessible to the bot to start dragging.'
      )
    };
  }

  let index = 0;
  const intervalMs = Math.max(1, intervalSec) * 1000;

  // The drag function — runs on every tick
  const drag = async () => {
    try {
      // Refresh VC list and re-fetch member each tick to stay up-to-date
      vcList = getVoiceChannels();
      if (vcList.length === 0) return;

      // Re-fetch target member state
      const freshMember = await guild.members.fetch(target.id).catch(() => null);
      if (!freshMember || !freshMember.voice.channelId) {
        // User left all VCs — stop session automatically
        const session = activeDrags.get(sessionKey);
        if (session) {
          clearInterval(session.timer);
          activeDrags.delete(sessionKey);
        }
        return;
      }

      // Cycle through VCs in order (wraps around)
      index = index % vcList.length;
      const dest = vcList[index];
      index++;

      // Skip if already there
      if (freshMember.voice.channelId !== dest.id) {
        await freshMember.voice.setChannel(dest, `VCDrag — initiated by ${moderator.user.tag}`).catch(() => null);
      } else {
        // Pick next to avoid being stuck
        index = index % vcList.length;
        const altDest = vcList[index];
        index++;
        if (altDest && freshMember.voice.channelId !== altDest.id) {
          await freshMember.voice.setChannel(altDest, `VCDrag — initiated by ${moderator.user.tag}`).catch(() => null);
        }
      }
    } catch {
      // Silently absorb errors to keep the loop alive
    }
  };

  // Kick off the loop immediately then repeat
  await drag();
  const timer = setInterval(drag, intervalMs);

  activeDrags.set(sessionKey, {
    timer,
    initiatorId: moderator.id,
    targetId: target.id,
    targetTag: target.user.tag,
    startedAt: Date.now(),
    intervalSec
  });

  return {
    embed: embed.danger(
      '🌀 VC Drag Activated',
      `${target} is now being dragged through every voice channel every **${intervalSec}s**.\n\nUse \`/vcdragstop\` or \`!vcdragstop @${target.user.username}\` to stop.`,
      [
        { name: '🎯 Target', value: `${target.user.tag} (${target.id})`, inline: true },
        { name: '⏱️ Interval', value: `${intervalSec} second(s)`, inline: true },
        { name: '📡 Voice Channels', value: `${vcList.length} channels in rotation`, inline: true }
      ]
    )
  };
}

// ─────────────────────────────────────────────────────────────
function handleVcDragStop(guild, moderator, target) {
  const sessionKey = `${guild.id}:${target.id}`;

  if (!activeDrags.has(sessionKey)) {
    return {
      embed: embed.warn(
        'No Active Session',
        `There is no active VC drag session for ${target}.`
      )
    };
  }

  const session = activeDrags.get(sessionKey);
  clearInterval(session.timer);
  activeDrags.delete(sessionKey);

  const durationSec = Math.round((Date.now() - session.startedAt) / 1000);

  return {
    embed: embed.success(
      '⏹️ VC Drag Stopped',
      `The VC drag session for **${session.targetTag}** has been terminated.`,
      [
        { name: '🎯 Target', value: session.targetTag, inline: true },
        { name: '⏱️ Session Duration', value: `${durationSec}s`, inline: true },
        { name: '🛑 Stopped By', value: moderator.user.tag, inline: true }
      ]
    )
  };
}

// ─────────────────────────────────────────────────────────────
function handleVcDragList(guild) {
  const sessions = [];

  for (const [key, session] of activeDrags.entries()) {
    if (key.startsWith(guild.id + ':')) {
      const durationSec = Math.round((Date.now() - session.startedAt) / 1000);
      sessions.push({
        name: `🎯 ${session.targetTag}`,
        value: `ID: \`${session.targetId}\` | Interval: **${session.intervalSec}s** | Running: **${durationSec}s**`,
        inline: false
      });
    }
  }

  if (sessions.length === 0) {
    return {
      embed: embed.info('No Active Drags', 'There are no ongoing VC drag sessions in this server.')
    };
  }

  return {
    embed: embed.info(
      `🌀 Active VC Drag Sessions (${sessions.length})`,
      `Use \`/vcdragstop <@user>\` to stop any session.`,
      sessions
    )
  };
}

// ─────────────────────────────────────────────────────────────
async function handleMassDisconnect(targetVc, moderator) {
  let count = 0;
  const promises = [];
  targetVc.members.forEach(member => {
    if (member.id === moderator.id) return; // Command executor is immune
    if (isBotOwnerSync(member.id)) return; // Bot owner immune
    if (isExtraOwner(targetVc.guild.id, member.id)) return; // Extra owners immune
    promises.push(member.voice.disconnect().catch(() => null));
    count++;
  });

  await Promise.all(promises);
  return { embed: embed.success('Mass Disconnect', `Successfully disconnected **${count}** users from ${targetVc}.`) };
}

// ─────────────────────────────────────────────────────────────
async function handleMassMove(sourceVc, destVc, moderator) {
  if (sourceVc.id === destVc.id) {
    return { embed: embed.warn('Invalid Destination', 'Source and destination channels cannot be the same.') };
  }

  let count = 0;
  const promises = [];
  sourceVc.members.forEach(member => {
    promises.push(member.voice.setChannel(destVc).catch(() => null));
    count++;
  });

  await Promise.all(promises);
  return { embed: embed.success('Mass Move', `Successfully moved **${count}** users from ${sourceVc} to ${destVc}.`) };
}
