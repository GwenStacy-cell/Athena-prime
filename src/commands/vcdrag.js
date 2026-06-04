import { PermissionFlagsBits, ChannelType } from 'discord.js';
import embed from '../embed.js';
import { isBotOwnerSync, isExtraOwner } from '../utils/helpers.js';

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
