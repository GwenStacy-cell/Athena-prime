import { PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import embed from '../embed.js';
import { isBotOwnerSync, isExtraOwner, isAuthorized } from '../utils/helpers.js';
import db from '../database.js';

// ============================================================
// ACTIVE DRAG SESSIONS — keyed by `${guildId}:${targetUserId}`
// Holds the interval reference so it can be cleared by /vcdragstop
// ============================================================
const activeDrags = new Map();

export function isUserInDragSession(guildId, userId) {
  return activeDrags.has(`${guildId}:${userId}`);
}

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
      { name: 'target', description: 'The user to drag', type: 6, required: true },
      { name: 'interval', description: 'Interval in seconds (default 2)', type: 4, required: false }
    ],

    async executePrefix(message, args) {
      if (!(await isAuthorized(message.author, message.guild))) return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} Only owners can use this command.`)] });
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
      if (!(await isAuthorized(interaction.user, interaction.guild))) return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} Only owners can use this command.`)], flags: 64 });
      const target = interaction.options.getMember('target');
      const intervalSec = interaction.options.getInteger('interval') || 2;
      const result = await handleVcDrag(interaction.guild, interaction.member, target, intervalSec);
      await interaction.reply({ embeds: [result.embed] });
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
      { name: 'target', description: 'The user to stop dragging', type: 6, required: true }
    ],

    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} Only owners can use this command.`)] });
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
      if (!(await isAuthorized(interaction.user, interaction.guild))) return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} Only owners can use this command.`)], flags: 64 });
      const target = interaction.options.getMember('target');
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
      if (!(await isAuthorized(message.author, message.guild))) return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} Only owners can use this command.`)] });
      const result = handleVcDragList(message.guild);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} Only owners can use this command.`)], flags: 64 });
      const result = handleVcDragList(interaction.guild);
      await interaction.reply({ embeds: [result.embed] });
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
      { name: 'channel', description: 'The voice channel to disconnect users from', type: 7, channel_types: [2, 13], required: false }
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
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} Only the **Bot Owner**, **Server Owner**, and **Extra Owners** can use mass commands.`)], flags: 64 });
      }

      let targetVc = interaction.options.getChannel('channel') || interaction.member.voice.channel;

      if (!targetVc || (targetVc.type !== ChannelType.GuildVoice && targetVc.type !== ChannelType.GuildStageVoice)) {
        return interaction.reply({ embeds: [embed.warn('Channel Not Found', 'Please specify a valid voice channel, or join one first.')], flags: 64 });
      }

      const result = await handleMassDisconnect(targetVc, interaction.member);
      await interaction.reply({ embeds: [result.embed], flags: 64 });
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
      { name: 'destination', description: 'The voice channel to move users TO', type: 7, channel_types: [2, 13], required: true },
      { name: 'source', description: 'The voice channel to move users FROM (defaults to your VC)', type: 7, channel_types: [2, 13], required: false }
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
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} Only the **Bot Owner**, **Server Owner**, and **Extra Owners** can use mass commands.`)], flags: 64 });
      }

      const destVc = interaction.options.getChannel('destination');
      const sourceVc = interaction.options.getChannel('source') || interaction.member.voice.channel;

      if (!sourceVc) return interaction.reply({ embeds: [embed.warn('Source Not Found', 'You must be in a voice channel, or specify a source channel.')], flags: 64 });
      if (!destVc) return interaction.reply({ embeds: [embed.warn('Destination Not Found', 'Could not find the destination voice channel.')], flags: 64 });
      if (sourceVc.type !== ChannelType.GuildVoice && sourceVc.type !== ChannelType.GuildStageVoice) return interaction.reply({ embeds: [embed.warn('Invalid Source', 'Source must be a voice channel.')], flags: 64 });
      if (destVc.type !== ChannelType.GuildVoice && destVc.type !== ChannelType.GuildStageVoice) return interaction.reply({ embeds: [embed.warn('Invalid Destination', 'Destination must be a voice channel.')], flags: 64 });

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
        ' Untouchable',
        ` **${target.user.tag}** is protected by Athena Prime and cannot be dragged.`
      )
    };
  }

  // Move Protected users are immune
  if (db.isMoveProtected(guild.id, target.id)) {
    return {
      embed: embed.danger(
        ' Move Protected',
        `**${target.user.tag}** is currently enrolled in Move Protection. They cannot be targeted by VC drag sessions.`
      )
    };
  }

  // (We no longer fail if they aren't in a VC initially, the drag will just wait for them to join)

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
  let wasInVc = !!target.voice.channelId;

  // The drag function — runs on every tick
  const drag = async () => {
    try {
      // Refresh VC list and re-fetch member each tick to stay up-to-date
      vcList = getVoiceChannels();
      if (vcList.length === 0) return;

      // Re-fetch target member state
      const freshMember = await guild.members.fetch(target.id).catch(() => null);
      if (!freshMember || !freshMember.voice.channelId) {
        // User left all VCs or left the server completely
        // Do NOT clear the timer! We wait silently until they join again.
        wasInVc = false;
        return;
      }

      if (!wasInVc) {
        wasInVc = true;
        const currentVc = guild.channels.cache.get(freshMember.voice.channelId);
        if (currentVc && currentVc.isTextBased()) {
          const resEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('<a:Dark4luvontop:1524405545690202253> Drag Resumed')
            .setDescription(`**${freshMember.user.tag}** has rejoined voice. The endless drag session has instantly resumed!`);
          currentVc.send({ content: `${freshMember}`, embeds: [resEmbed] }).catch(() => null);
        }
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
      ' VC Drag Activated',
      `${target} is now being dragged through every voice channel every **${intervalSec}s**.\n\nUse \`/vcdragstop\` or \`!vcdragstop @${target.user.username}\` to stop.`,
      [
        { name: 'Target', value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Interval', value: `${intervalSec} second(s)`, inline: true },
        { name: 'Voice Channels', value: `${vcList.length} channels in rotation`, inline: true }
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
      'VC Drag Stopped',
      `The VC drag session for **${session.targetTag}** has been terminated.`,
      [
        { name: 'Target', value: session.targetTag, inline: true },
        { name: 'Session Duration', value: `${durationSec}s`, inline: true },
        { name: 'Stopped By', value: moderator.user.tag, inline: true }
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
        name: `Session: ${session.targetTag}`,
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
      ` Active VC Drag Sessions (${sessions.length})`,
      `Use \`/vcdragstop <@user>\` to stop any session.`,
      sessions
    )
  };
}

// ─────────────────────────────────────────────────────────────
async function handleMassDisconnect(targetVc, moderator, interaction = null) {
  let count = 0;
  let skipped = 0;
  const promises = [];
  targetVc.members.forEach(member => {
    if (member.id === moderator.id) return; // Command executor is immune
    if (isBotOwnerSync(member.id)) return; // Bot owner immune
    if (isExtraOwner(targetVc.guild.id, member.id)) return; // Extra owners immune
    
    // Skip move-protected users
    if (db.isMoveProtected(targetVc.guild.id, member.id)) {
      skipped++;
      return;
    }

    promises.push(
      member.voice.disconnect()
        .then(() => {
          count++;
          if (interaction && count % 15 === 0) {
            interaction.editReply({ embeds: [embed.info('Mass Disconnect', `Disconnecting in progress...\n\n Disconnected: **${count}**\n Skipped (Protected): **${skipped}**`)] }).catch(() => null);
          }
        })
        .catch(() => null)
    );
  });

  await Promise.all(promises);
  let msg = `Successfully disconnected **${count}** users from ${targetVc}.`;
  if (skipped > 0) msg += `\n\n>  **${skipped}** users were skipped due to active **Move Protection**.`;
  return { embed: embed.success('Mass Disconnect', msg) };
}

// ─────────────────────────────────────────────────────────────
async function handleMassMove(sourceVc, destVc, moderator, interaction = null) {
  if (sourceVc.id === destVc.id) {
    return { embed: embed.warn('Invalid Destination', 'Source and destination channels cannot be the same.') };
  }

  let count = 0;
  let skipped = 0;
  const promises = [];
  sourceVc.members.forEach(member => {
    // Skip move-protected users
    if (db.isMoveProtected(sourceVc.guild.id, member.id)) {
      skipped++;
      return;
    }

    promises.push(
      member.voice.setChannel(destVc)
        .then(() => {
          count++;
          if (interaction && count % 15 === 0) {
            interaction.editReply({ embeds: [embed.info('Mass Move', `Moving in progress...\n\n Moved: **${count}**\n Skipped (Protected): **${skipped}**`)] }).catch(() => null);
          }
        })
        .catch(() => null)
    );
  });

  await Promise.all(promises);
  let msg = `Successfully moved **${count}** users from ${sourceVc} to ${destVc}.`;
  if (skipped > 0) msg += `\n\n>  **${skipped}** users were skipped due to active **Move Protection**.`;
  return { embed: embed.success('Mass Move', msg) };
}
