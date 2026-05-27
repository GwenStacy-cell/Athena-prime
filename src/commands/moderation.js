import { PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { parseDuration, canModerate, logToSecurityChannel } from '../utils/helpers.js';
import { executeQuarantine } from './security.js'; // We will implement security.js next

export const commands = [
  // --- MUTEALL COMMAND ---
  {
    name: 'muteall',
    description: 'Mutes all members in the text channel or your current voice channel.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.MuteMembers, PermissionFlagsBits.ManageChannels],
    options: [
      {
        name: 'type',
        description: 'Mute text chat or voice chat (defaults to voice if in channel, otherwise text)',
        type: 3, // String
        required: false,
        choices: [
          { name: 'Text Chat', value: 'text' },
          { name: 'Voice Chat', value: 'voice' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const typeArg = args[0]?.toLowerCase();
      let type = 'text';

      if (typeArg === 'voice' || typeArg === 'text') {
        type = typeArg;
      } else if (message.member.voice.channel) {
        type = 'voice';
      }

      const result = await handleMuteAll(message.guild, message.channel, message.member, type);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      let type = interaction.options.getString('type');
      if (!type) {
        type = interaction.member.voice.channel ? 'voice' : 'text';
      }

      const result = await handleMuteAll(interaction.guild, interaction.channel, interaction.member, type);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- UNMUTEALL COMMAND ---
  {
    name: 'unmuteall',
    description: 'Unmutes all members in the text channel or your current voice channel.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.MuteMembers, PermissionFlagsBits.ManageChannels],
    options: [
      {
        name: 'type',
        description: 'Unmute text chat or voice chat (defaults to voice if in channel, otherwise text)',
        type: 3,
        required: false,
        choices: [
          { name: 'Text Chat', value: 'text' },
          { name: 'Voice Chat', value: 'voice' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const typeArg = args[0]?.toLowerCase();
      let type = 'text';

      if (typeArg === 'voice' || typeArg === 'text') {
        type = typeArg;
      } else if (message.member.voice.channel) {
        type = 'voice';
      }

      const result = await handleUnmuteAll(message.guild, message.channel, message.member, type);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      let type = interaction.options.getString('type');
      if (!type) {
        type = interaction.member.voice.channel ? 'voice' : 'text';
      }

      const result = await handleUnmuteAll(interaction.guild, interaction.channel, interaction.member, type);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- WARN COMMAND ---
  {
    name: 'warn',
    description: 'Issues a formal warning to a user and logs it.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ModerateMembers],
    options: [
      {
        name: 'user',
        description: 'The member to warn',
        type: 6, // User
        required: true
      },
      {
        name: 'reason',
        description: 'Reason for the warning',
        type: 3, // String
        required: true
      }
    ],
    async executePrefix(message, args) {
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Please mention a valid member to warn.')] });
      }
      
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const result = await handleWarn(message.guild, message.member, target, reason);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) {
        return interaction.reply({ embeds: [embed.warn('Command Error', 'Member not found in this server.')], ephemeral: true });
      }

      const result = await handleWarn(interaction.guild, interaction.member, target, reason);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- WARNINGS COMMAND ---
  {
    name: 'warnings',
    description: 'Shows active warnings for a member.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ModerateMembers],
    options: [
      {
        name: 'user',
        description: 'The member whose warnings to view',
        type: 6,
        required: true
      }
    ],
    async executePrefix(message) {
      const target = message.mentions.members.first() || message.member;
      const result = await handleWarnings(message.guild, target);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!target) {
        return interaction.reply({ embeds: [embed.warn('Command Error', 'Member not found.')], ephemeral: true });
      }

      const result = await handleWarnings(interaction.guild, target);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- CLEARWARNS COMMAND ---
  {
    name: 'clearwarns',
    description: 'Clears all active warnings for a member.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ModerateMembers],
    options: [
      {
        name: 'user',
        description: 'The member whose warnings will be cleared',
        type: 6,
        required: true
      }
    ],
    async executePrefix(message) {
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Please mention a valid member to clear warnings.')] });
      }
      const result = await handleClearWarns(message.guild, message.member, target);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!target) {
        return interaction.reply({ embeds: [embed.warn('Command Error', 'Member not found.')], ephemeral: true });
      }

      const result = await handleClearWarns(interaction.guild, interaction.member, target);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- TIMEOUT COMMAND ---
  {
    name: 'timeout',
    description: 'Places a member on timeout (native Discord mute).',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ModerateMembers],
    options: [
      {
        name: 'user',
        description: 'Member to mute',
        type: 6,
        required: true
      },
      {
        name: 'duration',
        description: 'Duration (e.g. 10m, 2h, 1d)',
        type: 3,
        required: true
      },
      {
        name: 'reason',
        description: 'Reason for the timeout',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Please mention a valid member.')] });
      }
      
      const durationStr = args[1];
      const reason = args.slice(2).join(' ') || 'No reason provided';

      const result = await handleTimeout(message.guild, message.member, target, durationStr, reason);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const durationStr = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) {
        return interaction.reply({ embeds: [embed.warn('Command Error', 'Member not found.')], ephemeral: true });
      }

      const result = await handleTimeout(interaction.guild, interaction.member, target, durationStr, reason);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- KICK COMMAND ---
  {
    name: 'kick',
    description: 'Kicks a member from the server.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.KickMembers],
    options: [
      {
        name: 'user',
        description: 'Member to kick',
        type: 6,
        required: true
      },
      {
        name: 'reason',
        description: 'Reason for kick',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Please mention a valid member.')] });
      }
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const result = await handleKick(message.guild, message.member, target, reason);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) {
        return interaction.reply({ embeds: [embed.warn('Command Error', 'Member not found.')], ephemeral: true });
      }

      const result = await handleKick(interaction.guild, interaction.member, target, reason);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- BAN COMMAND ---
  {
    name: 'ban',
    description: 'Permanently bans a member from the server.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.BanMembers],
    options: [
      {
        name: 'user',
        description: 'Member to ban',
        type: 6,
        required: true
      },
      {
        name: 'reason',
        description: 'Reason for ban',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Please mention a valid member.')] });
      }
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const result = await handleBan(message.guild, message.member, target, reason);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) {
        return interaction.reply({ embeds: [embed.warn('Command Error', 'Member not found.')], ephemeral: true });
      }

      const result = await handleBan(interaction.guild, interaction.member, target, reason);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- SAY COMMAND ---
  {
    name: 'say',
    description: 'Sends a raw text message to the designated channel.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageMessages],
    options: [
      {
        name: 'message',
        description: 'The text message to send',
        type: 3,
        required: true
      },
      {
        name: 'channel',
        description: 'Optional target text channel',
        type: 7,
        required: false
      }
    ],
    async executePrefix(message, args) {
      if (args.length === 0) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Please enter a message to send. Usage: `!say [#channel or id] <message>`')] });
      }

      let channel = null;
      let text = '';

      // Try to parse the first argument as a channel mention, ID, or name
      const firstArg = args[0].replace(/[<#>]/g, '');
      const possibleChannel = message.guild.channels.cache.get(firstArg) 
        || message.guild.channels.cache.find(c => c.name.toLowerCase() === firstArg.toLowerCase());

      if (possibleChannel && possibleChannel.type === ChannelType.GuildText) {
        channel = possibleChannel;
        text = args.slice(1).join(' ');
      } else {
        channel = message.channel;
        text = args.join(' ');
      }

      if (!text.trim()) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Please enter a message to send.')] });
      }

      await channel.send(text);
      await message.react('✅').catch(() => null);
    },
    async executeSlash(interaction) {
      const text = interaction.options.getString('message');
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.PublicThread && channel.type !== ChannelType.PrivateThread) {
        return interaction.reply({ embeds: [embed.warn('Command Error', 'Target channel must be a text channel.')], ephemeral: true });
      }

      await channel.send(text);
      await interaction.reply({ embeds: [embed.success('Message Dispatched', `Message successfully sent to ${channel}.`)], ephemeral: true });
    }
  },

  // --- ANNOUNCE COMMAND ---
  {
    name: 'announce',
    description: 'Publishes a highly styled announcement card embed.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageMessages],
    options: [
      {
        name: 'channel',
        description: 'Target text channel',
        type: 7,
        required: true
      },
      {
        name: 'title',
        description: 'Announcement header',
        type: 3,
        required: true
      },
      {
        name: 'message',
        description: 'Announcement content description',
        type: 3,
        required: true
      }
    ],
    async executePrefix(message, args) {
      const channel = message.mentions.channels.first();
      if (!channel) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Usage: `!announce #channel Title | Message`')] });
      }

      const remainder = args.slice(1).join(' ');
      const parts = remainder.split('|');
      const title = parts[0]?.trim();
      const text = parts[1]?.trim();

      if (!title || !text) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Please separate the Title and Message with a `|` (e.g. `!announce #general Server Update | We have added security logs!`)')] });
      }

      const announceEmbed = embed.success(title, text);
      await channel.send({ embeds: [announceEmbed] });
      await message.react('✅').catch(() => null);
    },
    async executeSlash(interaction) {
      const channel = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');
      const text = interaction.options.getString('message');

      if (channel.type !== ChannelType.GuildText) {
        return interaction.reply({ embeds: [embed.warn('Command Error', 'Target channel must be a text channel.')], ephemeral: true });
      }

      const announceEmbed = embed.success(title, text);
      await channel.send({ embeds: [announceEmbed] });
      await interaction.reply({ embeds: [embed.success('Announcement Published', `Successfully posted announcement to ${channel}.`)], ephemeral: true });
    }
  },

  // --- CREATE ROLE COMMAND ---
  {
    name: 'createrole',
    description: 'Creates a new server role with a specified name and hex color.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageRoles],
    options: [
      {
        name: 'name',
        description: 'The name of the role',
        type: 3,
        required: true
      },
      {
        name: 'color',
        description: 'Hex color (e.g. #00ffaa)',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const name = args[0];
      if (!name) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Please specify a name for the role.')] });
      }
      const color = args[1];
      const result = await handleCreateRole(message.guild, message.member, name, color);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const name = interaction.options.getString('name');
      const color = interaction.options.getString('color');
      const result = await handleCreateRole(interaction.guild, interaction.member, name, color);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- DELETE ROLE COMMAND ---
  {
    name: 'deleterole',
    description: 'Deletes a server role safely.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageRoles],
    options: [
      {
        name: 'role',
        description: 'The role to delete',
        type: 8,
        required: true
      }
    ],
    async executePrefix(message) {
      const role = message.mentions.roles.first();
      if (!role) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Please mention the role you want to delete.')] });
      }
      const result = await handleDeleteRole(message.guild, message.member, role);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const role = interaction.options.getRole('role');
      const result = await handleDeleteRole(interaction.guild, interaction.member, role);
      await interaction.reply({ embeds: [result.embed] });
    }
  }
];

// ==========================================
// CORE EXECUTION HANDLERS (DRY APPROACH)
// ==========================================

async function handleMuteAll(guild, channel, moderator, type) {
  if (type === 'voice') {
    const vc = moderator.voice.channel;
    if (!vc) {
      return { embed: embed.warn('MuteAll Failed', 'You must be in a voice channel to use `muteall voice`.') };
    }

    let mutedCount = 0;
    for (const m of vc.members.values()) {
      if (m.id !== moderator.id && canModerate(moderator, m)) {
        await m.voice.setMute(true, `MuteAll by ${moderator.user.tag}`).catch(() => null);
        mutedCount++;
      }
    }

    const resEmbed = embed.danger('Voice Mute Completed', `Successfully muted **${mutedCount}** members in voice channel **${vc.name}**.`);
    logToSecurityChannel(guild, embed.log('MuteAll Voice Channel', `Moderator **${moderator.user.tag}** muted all **${mutedCount}** members in **${vc.name}**.`, [], 'warning'));
    return { embed: resEmbed };
  } else {
    // Text Channel lockdown override
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: false
    }, { reason: `MuteAll text by ${moderator.user.tag}` });

    const resEmbed = embed.danger('Channel Locked Down', `This channel **#${channel.name}** has been locked down. Non-moderators are muted.`);
    logToSecurityChannel(guild, embed.log('MuteAll Text Channel', `Moderator **${moderator.user.tag}** locked down channel **#${channel.name}**.`, [], 'warning'));
    return { embed: resEmbed };
  }
}

async function handleUnmuteAll(guild, channel, moderator, type) {
  if (type === 'voice') {
    const vc = moderator.voice.channel;
    if (!vc) {
      return { embed: embed.warn('UnmuteAll Failed', 'You must be in a voice channel to use `unmuteall voice`.') };
    }

    let unmutedCount = 0;
    for (const m of vc.members.values()) {
      await m.voice.setMute(false, `UnmuteAll by ${moderator.user.tag}`).catch(() => null);
      unmutedCount++;
    }

    const resEmbed = embed.success('Voice Unmute Completed', `Successfully unmuted **${unmutedCount}** members in voice channel **${vc.name}**.`);
    logToSecurityChannel(guild, embed.log('UnmuteAll Voice Channel', `Moderator **${moderator.user.tag}** unmuted all **${unmutedCount}** members in **${vc.name}**.`, [], 'success'));
    return { embed: resEmbed };
  } else {
    // Revert Text override
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: null
    }, { reason: `UnmuteAll text by ${moderator.user.tag}` });

    const resEmbed = embed.success('Channel Unlocked', `This channel **#${channel.name}** has been unlocked. Users can chat now.`);
    logToSecurityChannel(guild, embed.log('UnmuteAll Text Channel', `Moderator **${moderator.user.tag}** unlocked channel **#${channel.name}**.`, [], 'success'));
    return { embed: resEmbed };
  }
}

async function handleWarn(guild, moderator, target, reason) {
  if (!canModerate(moderator, target)) {
    return { embed: embed.danger('Permission Denied', `You do not have enough power to warn **${target.user.tag}**.`) };
  }

  const warns = db.addWarning(guild.id, target.id, moderator.id, reason);

  // Advanced DM Embed
  const dmEmbed = embed.warn(
    'Warning Received', 
    `You have been issued a warning in **${guild.name}** by one of the server moderators.`,
    [
      { name: 'Reason', value: reason, inline: true },
      { name: 'Warn Total', value: `\`${warns.length}\` / 3`, inline: true }
    ]
  );
  await target.send({ embeds: [dmEmbed] }).catch(() => null);

  // Response channel embed
  const resEmbed = embed.warn(
    'User Warned', 
    `Successfully warned **${target.user.tag}**.`,
    [
      { name: 'User', value: `${target}`, inline: true },
      { name: 'Moderator', value: `${moderator}`, inline: true },
      { name: 'Warn Count', value: `\`${warns.length}\``, inline: true },
      { name: 'Reason', value: reason }
    ]
  );

  // Log to logs channel
  logToSecurityChannel(guild, embed.log(
    'Warning Issued', 
    `Moderator warned user.`,
    [
      { name: 'Target', value: `${target.user.tag} (${target.id})`, inline: true },
      { name: 'Moderator', value: `${moderator.user.tag}`, inline: true },
      { name: 'Reason', value: reason },
      { name: 'Active Warns', value: `${warns.length}` }
    ],
    'warning'
  ));

  // Check Warn thresholds for auto punishment
  if (warns.length >= 3) {
    // Automatic quarantine!
    const autoReason = `Automated: Warning threshold limit exceeded (${warns.length}/3 Warnings)`;
    const quarantineRes = await executeQuarantine(guild, target, guild.members.me, autoReason);
    
    // Clear warning counts so they don't get double punished next message
    db.clearWarnings(guild.id, target.id);

    return { 
      embed: embed.danger(
        'Severe Warning Threshold Reached', 
        `**${target.user.tag}** accumulated ${warns.length} warnings. Executing **automatic quarantine punishment**.\n\n${quarantineRes.message}`
      )
    };
  }

  return { embed: resEmbed };
}

async function handleWarnings(guild, target) {
  const warns = db.getWarnings(guild.id, target.id);

  if (warns.length === 0) {
    return { embed: embed.success('Warnings Clear', `**${target.user.tag}** has clean record. No active warnings!`) };
  }

  const fields = warns.map((w, index) => ({
    name: `Warning #${index + 1} - <t:${Math.floor(w.timestamp / 1000)}:R>`,
    value: `**Reason:** ${w.reason}\n**Warner:** <@${w.warnerId}>`
  }));

  const resEmbed = embed.info(
    `Warning History: ${target.user.tag}`, 
    `This member currently has **${warns.length}** active warnings recorded on disk.`, 
    fields
  );
  return { embed: resEmbed };
}

async function handleClearWarns(guild, moderator, target) {
  const activeCount = db.getWarnings(guild.id, target.id).length;
  
  if (activeCount === 0) {
    return { embed: embed.info('No warnings', `User **${target.user.tag}** has no warnings to clear.`) };
  }

  db.clearWarnings(guild.id, target.id);

  const resEmbed = embed.success('Warnings Cleared', `Successfully cleared all active warnings for **${target.user.tag}**.`);
  logToSecurityChannel(guild, embed.log(
    'Warnings Wiped',
    `Moderator **${moderator.user.tag}** cleared **${activeCount}** active warnings for **${target.user.tag}** (${target.id}).`,
    [],
    'success'
  ));
  return { embed: resEmbed };
}

async function handleTimeout(guild, moderator, target, durationStr, reason) {
  if (!canModerate(moderator, target)) {
    return { embed: embed.danger('Permission Denied', `You do not have enough power to timeout **${target.user.tag}**.`) };
  }

  const ms = parseDuration(durationStr);
  if (!ms || ms < 10000 || ms > 2419200000) { // Discord timeout limit is between 10s and 28 days
    return { embed: embed.warn('Invalid Duration', 'Duration must be a format like `10m`, `2h`, `1d` (between 10 seconds and 28 days).') };
  }

  try {
    await target.timeout(ms, `${reason} - by ${moderator.user.tag}`);

    // Send DM
    const dmEmbed = embed.danger('Timeout Restrict', `You have been timed out in **${guild.name}**.`, [
      { name: 'Duration', value: durationStr, inline: true },
      { name: 'Reason', value: reason, inline: true }
    ]);
    await target.send({ embeds: [dmEmbed] }).catch(() => null);

    const resEmbed = embed.danger('Timeout Executed', `Successfully placed **${target.user.tag}** on timeout.`, [
      { name: 'Member', value: `${target}`, inline: true },
      { name: 'Duration', value: durationStr, inline: true },
      { name: 'Reason', value: reason }
    ]);

    logToSecurityChannel(guild, embed.log(
      'Member Timeout',
      `Moderator timed out member.`,
      [
        { name: 'Target', value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${moderator.user.tag}`, inline: true },
        { name: 'Duration', value: durationStr, inline: true },
        { name: 'Reason', value: reason }
      ],
      'danger'
    ));

    return { embed: resEmbed };
  } catch (error) {
    console.error(error);
    return { embed: embed.danger('Timeout Failed', 'An error occurred while executing the timeout. Ensure my role is higher than the target.') };
  }
}

async function handleKick(guild, moderator, target, reason) {
  if (!canModerate(moderator, target)) {
    return { embed: embed.danger('Permission Denied', `You do not have enough power to kick **${target.user.tag}**.`) };
  }

  if (!target.kickable) {
    return { embed: embed.danger('Action Failed', `I do not have enough role permissions to kick **${target.user.tag}**.`) };
  }

  try {
    // DM target
    const dmEmbed = embed.danger('Kicked from Server', `You have been kicked from **${guild.name}**.`, [
      { name: 'Reason', value: reason }
    ]);
    await target.send({ embeds: [dmEmbed] }).catch(() => null);

    await target.kick(`${reason} - by ${moderator.user.tag}`);

    const resEmbed = embed.danger('Member Kicked', `Successfully kicked **${target.user.tag}**.`, [
      { name: 'Member', value: `${target.user.username}`, inline: true },
      { name: 'Reason', value: reason, inline: true }
    ]);

    logToSecurityChannel(guild, embed.log(
      'Member Kicked',
      `Moderator kicked member.`,
      [
        { name: 'Target', value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${moderator.user.tag}`, inline: true },
        { name: 'Reason', value: reason }
      ],
      'danger'
    ));

    return { embed: resEmbed };
  } catch (error) {
    console.error(error);
    return { embed: embed.danger('Kick Failed', 'An error occurred while kicking the user.') };
  }
}

async function handleBan(guild, moderator, target, reason) {
  if (!canModerate(moderator, target)) {
    return { embed: embed.danger('Permission Denied', `You do not have enough power to ban **${target.user.tag}**.`) };
  }

  if (!target.bannable) {
    return { embed: embed.danger('Action Failed', `I do not have enough role permissions to ban **${target.user.tag}**.`) };
  }

  try {
    // DM target
    const dmEmbed = embed.danger('Banned from Server', `You have been permanently banned from **${guild.name}**.`, [
      { name: 'Reason', value: reason }
    ]);
    await target.send({ embeds: [dmEmbed] }).catch(() => null);

    await target.ban({ reason: `${reason} - by ${moderator.user.tag}` });

    const resEmbed = embed.danger('Member Banned', `Successfully banned **${target.user.tag}** permanently.`, [
      { name: 'Member', value: `${target.user.username}`, inline: true },
      { name: 'Reason', value: reason, inline: true }
    ]);

    logToSecurityChannel(guild, embed.log(
      'Member Banned',
      `Moderator banned member.`,
      [
        { name: 'Target', value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${moderator.user.tag}`, inline: true },
        { name: 'Reason', value: reason }
      ],
      'danger'
    ));

    return { embed: resEmbed };
  } catch (error) {
    console.error(error);
    return { embed: embed.danger('Ban Failed', 'An error occurred while banning the user.') };
  }
}

async function handleCreateRole(guild, moderator, name, color) {
  let roleColor = null;
  if (color) {
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      roleColor = color;
    } else {
      return { embed: embed.warn('Invalid Color', 'Please provide a valid hex color code (e.g. `#00ffaa`).') };
    }
  }

  try {
    const role = await guild.roles.create({
      name,
      color: roleColor || undefined,
      reason: `Created by ${moderator.user.tag}`
    });

    const resEmbed = embed.success('Role Created', `Successfully created server role **${role.name}**.`, [
      { name: 'Role ID', value: `\`${role.id}\``, inline: true },
      { name: 'Hex Color', value: `\`${role.hexColor}\``, inline: true }
    ]);

    logToSecurityChannel(guild, embed.log(
      'Role Created',
      `Moderator created a new role.`,
      [
        { name: 'Role Name', value: `${role.name}`, inline: true },
        { name: 'Moderator', value: `${moderator.user.tag}`, inline: true }
      ],
      'success'
    ));

    return { embed: resEmbed };
  } catch (error) {
    console.error(error);
    return { embed: embed.danger('Action Failed', 'Failed to create the role. Ensure my role is high enough and I have Manage Roles permission.') };
  }
}

async function handleDeleteRole(guild, moderator, role) {
  if (role.managed) {
    return { embed: embed.danger('Delete Failed', 'You cannot delete managed roles (roles tied to bots or integrations).') };
  }

  if (role.position >= moderator.roles.highest.position && moderator.id !== guild.ownerId) {
    return { embed: embed.danger('Permission Denied', 'You cannot delete a role that is equal to or higher than your highest role.') };
  }

  try {
    const roleName = role.name;
    const roleId = role.id;
    await role.delete(`Deleted by ${moderator.user.tag}`);

    const resEmbed = embed.success('Role Deleted', `Successfully deleted role **${roleName}** (ID: ${roleId}).`);

    logToSecurityChannel(guild, embed.log(
      'Role Deleted',
      `Moderator deleted a role.`,
      [
        { name: 'Role Name', value: `${roleName}`, inline: true },
        { name: 'Moderator', value: `${moderator.user.tag}`, inline: true }
      ],
      'danger'
    ));

    return { embed: resEmbed };
  } catch (error) {
    console.error(error);
    return { embed: embed.danger('Action Failed', 'Failed to delete the role. Ensure my highest role is above the target role.') };
  }
}

