import {
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

// ==========================================
// JTC CONTROL PANEL BUILDER
// ==========================================
export function buildControlPanel(channel, owner) {
  const panelEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎙️ Voice Channel Control Panel')
    .setDescription(`Welcome to your personal voice channel, ${owner}!\nUse the buttons below to manage your room.`)
    .addFields(
      { name: '👑 Owner', value: `${owner}`, inline: true },
      { name: '📋 Channel', value: `${channel}`, inline: true },
      { name: '🔓 Status', value: '`Unlocked`', inline: true }
    )
    .setFooter({ text: 'Athena Prime • Join to Create' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('jtc_lock').setLabel('Lock').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('jtc_unlock').setLabel('Unlock').setEmoji('🔓').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('jtc_limit').setLabel('Set Limit').setEmoji('👥').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('jtc_rename').setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('jtc_info').setLabel('Info').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('jtc_permit').setLabel('Permit User').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('jtc_reject').setLabel('Reject User').setEmoji('🚫').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('jtc_transfer').setLabel('Transfer').setEmoji('👑').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('jtc_bitrate').setLabel('Bitrate').setEmoji('🎚️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('jtc_claim').setLabel('Claim').setEmoji('⚡').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [panelEmbed], components: [row1, row2] };
}

// ==========================================
// BUTTON INTERACTION HANDLER
// ==========================================
export async function handleJtcButton(interaction) {
  const customId = interaction.customId;
  const member = interaction.member;
  const guild = interaction.guild;

  // Find which JTC channel this button belongs to
  const vcChannel = member.voice?.channel;
  const jtcData = vcChannel ? db.getJtcChannel(vcChannel.id) : null;

  // For claim — user doesn't need to be owner, just in the channel
  if (customId === 'jtc_claim') {
    if (!vcChannel || !jtcData) {
      return interaction.reply({ embeds: [embed.warn('Not In Channel', 'You must be in a JTC voice channel to use this.')], ephemeral: true });
    }
    const ownerInChannel = vcChannel.members.has(jtcData.ownerId);
    if (ownerInChannel) {
      return interaction.reply({ embeds: [embed.warn('Cannot Claim', 'The current owner is still in the channel.')], ephemeral: true });
    }
    db.setJtcOwner(vcChannel.id, member.id);
    await vcChannel.permissionOverwrites.edit(member.id, { Connect: true, ManageChannels: true }).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Channel Claimed', `You are now the owner of **${vcChannel.name}**.`)] });
  }

  // All other actions require being the owner
  if (!jtcData || jtcData.ownerId !== member.id) {
    return interaction.reply({ embeds: [embed.danger('Not Owner', 'Only the channel owner can use these controls.')], ephemeral: true });
  }

  if (!vcChannel) {
    return interaction.reply({ embeds: [embed.warn('Not In Channel', 'You must be in your JTC voice channel.')], ephemeral: true });
  }

  // ─── LOCK ───
  if (customId === 'jtc_lock') {
    await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
    return interaction.reply({ embeds: [embed.danger('Channel Locked 🔒', 'No one new can join your channel.')] });
  }

  // ─── UNLOCK ───
  if (customId === 'jtc_unlock') {
    await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: null });
    return interaction.reply({ embeds: [embed.success('Channel Unlocked 🔓', 'Your channel is now open for anyone to join.')] });
  }

  // ─── LIMIT (prompt via reply + component collector) ───
  if (customId === 'jtc_limit') {
    const row = new ActionRowBuilder().addComponents(
      ...[0, 2, 5, 10, 25].map(n =>
        new ButtonBuilder().setCustomId(`jtc_setlimit_${n}`).setLabel(n === 0 ? 'No Limit' : `${n}`).setStyle(ButtonStyle.Primary)
      )
    );
    return interaction.reply({ embeds: [embed.info('Set User Limit', 'Choose a user limit for your channel:')], components: [row], ephemeral: true });
  }

  // ─── RENAME (ask via modal) ───
  if (customId === 'jtc_rename') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
    const modal = new ModalBuilder().setCustomId('jtc_rename_modal').setTitle('Rename Your Channel');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('jtc_new_name')
          .setLabel('New Channel Name')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Chill Zone')
          .setRequired(true)
          .setMaxLength(100)
      )
    );
    return interaction.showModal(modal);
  }

  // ─── PERMIT (prompt for user mention) ───
  if (customId === 'jtc_permit') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
    const modal = new ModalBuilder().setCustomId('jtc_permit_modal').setTitle('Permit a User');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('jtc_permit_userid')
          .setLabel('User ID to permit')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Right-click a user → Copy ID')
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // ─── REJECT (prompt for user id) ───
  if (customId === 'jtc_reject') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
    const modal = new ModalBuilder().setCustomId('jtc_reject_modal').setTitle('Reject a User');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('jtc_reject_userid')
          .setLabel('User ID to reject/ban from channel')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Right-click a user → Copy ID')
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // ─── TRANSFER ───
  if (customId === 'jtc_transfer') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
    const modal = new ModalBuilder().setCustomId('jtc_transfer_modal').setTitle('Transfer Ownership');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('jtc_transfer_userid')
          .setLabel('New Owner User ID')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Must be in the channel')
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // ─── BITRATE ───
  if (customId === 'jtc_bitrate') {
    const row = new ActionRowBuilder().addComponents(
      ...[64, 96, 128, 256, 384].map(br =>
        new ButtonBuilder().setCustomId(`jtc_setbitrate_${br}`).setLabel(`${br}kbps`).setStyle(ButtonStyle.Primary)
      )
    );
    return interaction.reply({ embeds: [embed.info('Set Bitrate', 'Choose a bitrate for your channel:')], components: [row], ephemeral: true });
  }

  // ─── INFO ───
  if (customId === 'jtc_info') {
    const members = vcChannel.members.map(m => m.toString()).join(', ') || 'None';
    const owner = await guild.members.fetch(jtcData.ownerId).catch(() => null);
    return interaction.reply({
      embeds: [embed.info('Channel Info', null, [
        { name: '📋 Name', value: vcChannel.name, inline: true },
        { name: '👑 Owner', value: owner?.toString() || `\`${jtcData.ownerId}\``, inline: true },
        { name: '👥 Limit', value: vcChannel.userLimit === 0 ? 'No Limit' : `${vcChannel.userLimit}`, inline: true },
        { name: '🎚️ Bitrate', value: `${vcChannel.bitrate / 1000}kbps`, inline: true },
        { name: '🌍 Region', value: vcChannel.rtcRegion || 'Auto', inline: true },
        { name: '👤 Members', value: members }
      ])],
      ephemeral: true
    });
  }
}

// ─── HANDLE LIMIT SELECT BUTTONS ───
export async function handleJtcLimitSelect(interaction) {
  const limit = parseInt(interaction.customId.replace('jtc_setlimit_', ''));
  const vcChannel = interaction.member.voice?.channel;
  if (!vcChannel) return interaction.reply({ embeds: [embed.warn('Not In Channel', 'Join your channel first.')], ephemeral: true });
  await vcChannel.setUserLimit(limit);
  await interaction.update({ embeds: [embed.success('Limit Updated', `User limit set to **${limit === 0 ? 'Unlimited' : limit}**.`)], components: [] });
}

// ─── HANDLE BITRATE SELECT BUTTONS ───
export async function handleJtcBitrateSelect(interaction) {
  const bitrate = parseInt(interaction.customId.replace('jtc_setbitrate_', '')) * 1000;
  const vcChannel = interaction.member.voice?.channel;
  if (!vcChannel) return interaction.reply({ embeds: [embed.warn('Not In Channel', 'Join your channel first.')], ephemeral: true });
  await vcChannel.setBitrate(bitrate).catch(() => null);
  await interaction.update({ embeds: [embed.success('Bitrate Updated', `Bitrate set to **${bitrate / 1000}kbps**.`)], components: [] });
}

// ─── HANDLE MODALS ───
export async function handleJtcModal(interaction) {
  const customId = interaction.customId;
  const member = interaction.member;
  const guild = interaction.guild;
  const vcChannel = member.voice?.channel;
  const jtcData = vcChannel ? db.getJtcChannel(vcChannel.id) : null;

  if (!jtcData || jtcData.ownerId !== member.id) {
    return interaction.reply({ embeds: [embed.danger('Not Owner', 'You are not the owner of this channel.')], ephemeral: true });
  }

  // ─── RENAME MODAL ───
  if (customId === 'jtc_rename_modal') {
    const newName = interaction.fields.getTextInputValue('jtc_new_name').trim();
    await vcChannel.setName(newName).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Channel Renamed', `Your channel has been renamed to **${newName}**.`)] });
  }

  // ─── PERMIT MODAL ───
  if (customId === 'jtc_permit_modal') {
    const userId = interaction.fields.getTextInputValue('jtc_permit_userid').trim().replace(/\D/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return interaction.reply({ embeds: [embed.warn('User Not Found', 'Could not find that user in this server.')], ephemeral: true });
    await vcChannel.permissionOverwrites.edit(userId, { Connect: true });
    return interaction.reply({ embeds: [embed.success('User Permitted', `${target} can now join your channel even when locked.`)] });
  }

  // ─── REJECT MODAL ───
  if (customId === 'jtc_reject_modal') {
    const userId = interaction.fields.getTextInputValue('jtc_reject_userid').trim().replace(/\D/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return interaction.reply({ embeds: [embed.warn('User Not Found', 'Could not find that user in this server.')], ephemeral: true });
    // Disconnect if in channel
    if (target.voice?.channelId === vcChannel.id) await target.voice.disconnect().catch(() => null);
    await vcChannel.permissionOverwrites.edit(userId, { Connect: false });
    return interaction.reply({ embeds: [embed.danger('User Rejected', `${target} has been removed and banned from your channel.`)] });
  }

  // ─── TRANSFER MODAL ───
  if (customId === 'jtc_transfer_modal') {
    const userId = interaction.fields.getTextInputValue('jtc_transfer_userid').trim().replace(/\D/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return interaction.reply({ embeds: [embed.warn('User Not Found', 'Could not find that user.')], ephemeral: true });
    if (!vcChannel.members.has(userId)) return interaction.reply({ embeds: [embed.warn('Not In Channel', 'That user must be in your channel to receive ownership.')], ephemeral: true });

    // Remove old owner perms, grant new owner perms
    await vcChannel.permissionOverwrites.edit(member.id, { ManageChannels: false }).catch(() => null);
    await vcChannel.permissionOverwrites.edit(userId, { Connect: true, ManageChannels: true }).catch(() => null);
    db.setJtcOwner(vcChannel.id, userId);
    return interaction.reply({ embeds: [embed.success('Ownership Transferred', `${target} is now the owner of this channel.`)] });
  }
}

// ==========================================
// SLASH COMMANDS
// ==========================================
export const commands = [
  // ─── JTCSETUP ───
  {
    name: 'jtcsetup',
    description: '⚙️ Set up the Join to Create system for this server. (Admin only)',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [
      {
        name: 'channel',
        description: 'Existing voice channel to use as lobby (leave empty to create one automatically)',
        type: 7, // CHANNEL
        required: false,
        channel_types: [2] // GUILD_VOICE
      },
      {
        name: 'category',
        description: 'Category to create temp channels in (leave empty to use the lobby\'s category)',
        type: 7,
        required: false,
        channel_types: [4] // CATEGORY
      }
    ],
    async executePrefix(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return;
      return message.reply({ embeds: [embed.info('Use Slash Command', 'Please use `/jtcsetup` for this command.')] });
    },
    async executeSlash(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;

      let lobbyChannel = interaction.options.getChannel('channel');
      let category = interaction.options.getChannel('category');

      // Auto-create category and lobby if not provided
      if (!lobbyChannel) {
        const cat = await guild.channels.create({
          name: '🎙️ Voice Rooms',
          type: ChannelType.GuildCategory,
          reason: 'Athena Prime JTC Setup'
        });
        lobbyChannel = await guild.channels.create({
          name: '➕ Join to Create',
          type: ChannelType.GuildVoice,
          parent: cat.id,
          reason: 'Athena Prime JTC Setup'
        });
        category = cat;
      }

      const categoryId = category?.id || lobbyChannel.parentId;
      db.setJtcConfig(guild.id, lobbyChannel.id, categoryId);

      await interaction.editReply({
        embeds: [embed.success('JTC System Activated ✅', [
          `**Lobby Channel:** ${lobbyChannel}`,
          `**Category:** ${categoryId ? `<#${categoryId}>` : 'Same as lobby'}`,
          '',
          'When someone joins the lobby, a private voice channel will be created for them automatically.',
          '',
          '**To disable:** `/jtcdisable`'
        ].join('\n'))]
      });
    }
  },

  // ─── JTCDISABLE ───
  {
    name: 'jtcdisable',
    description: '❌ Disable the Join to Create system. (Admin only)',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [],
    async executePrefix(message) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return;
      db.clearJtcConfig(message.guild.id);
      return message.reply({ embeds: [embed.danger('JTC Disabled', 'The Join to Create system has been turned off.')] });
    },
    async executeSlash(interaction) {
      db.clearJtcConfig(interaction.guild.id);
      return interaction.reply({ embeds: [embed.danger('JTC Disabled', 'The Join to Create system has been turned off.')], ephemeral: true });
    }
  },

  // ─── VC (all subcommands) ───
  {
    name: 'vc',
    description: '🎙️ Manage your personal JTC voice channel.',
    category: 'utility',
    permissions: [],
    options: [
      {
        name: 'name',
        description: 'Rename your voice channel',
        type: 1,
        options: [{ name: 'new_name', description: 'The new channel name', type: 3, required: true }]
      },
      {
        name: 'limit',
        description: 'Set user limit (0 = unlimited)',
        type: 1,
        options: [{ name: 'number', description: 'Max users (0-99)', type: 4, required: true, min_value: 0, max_value: 99 }]
      },
      {
        name: 'lock',
        description: 'Prevent others from joining',
        type: 1
      },
      {
        name: 'unlock',
        description: 'Reopen the channel to everyone',
        type: 1
      },
      {
        name: 'permit',
        description: 'Allow a specific user into a locked channel',
        type: 1,
        options: [{ name: 'user', description: 'User to permit', type: 6, required: true }]
      },
      {
        name: 'reject',
        description: 'Remove and ban a user from the channel',
        type: 1,
        options: [{ name: 'user', description: 'User to reject', type: 6, required: true }]
      },
      {
        name: 'transfer',
        description: 'Transfer channel ownership to another member',
        type: 1,
        options: [{ name: 'user', description: 'New owner (must be in channel)', type: 6, required: true }]
      },
      {
        name: 'bitrate',
        description: 'Change channel bitrate (kbps)',
        type: 1,
        options: [{ name: 'value', description: 'Bitrate in kbps (8-384)', type: 4, required: true, min_value: 8, max_value: 384 }]
      },
      {
        name: 'region',
        description: 'Change voice region',
        type: 1,
        options: [{
          name: 'region',
          description: 'Voice region',
          type: 3,
          required: true,
          choices: [
            { name: 'Auto', value: '' },
            { name: 'Brazil', value: 'brazil' },
            { name: 'Europe', value: 'europe' },
            { name: 'Hong Kong', value: 'hongkong' },
            { name: 'India', value: 'india' },
            { name: 'Japan', value: 'japan' },
            { name: 'Rotterdam', value: 'rotterdam' },
            { name: 'Russia', value: 'russia' },
            { name: 'Singapore', value: 'singapore' },
            { name: 'South Africa', value: 'southafrica' },
            { name: 'Sydney', value: 'sydney' },
            { name: 'US Central', value: 'us-central' },
            { name: 'US East', value: 'us-east' },
            { name: 'US South', value: 'us-south' },
            { name: 'US West', value: 'us-west' }
          ]
        }]
      },
      {
        name: 'claim',
        description: 'Claim ownership if the current owner left',
        type: 1
      },
      {
        name: 'info',
        description: 'Show your channel details',
        type: 1
      }
    ],

    async executePrefix(message, args) {
      return message.reply({ embeds: [embed.info('Use Slash Command', 'Please use `/vc` for voice channel management.')] });
    },

    async executeSlash(interaction) {
      const sub = interaction.options.getSubcommand();
      const member = interaction.member;
      const guild = interaction.guild;
      const vcChannel = member.voice?.channel;

      if (!vcChannel) {
        return interaction.reply({ embeds: [embed.warn('Not In Voice', 'You must be in a voice channel to use this command.')], ephemeral: true });
      }

      const jtcData = db.getJtcChannel(vcChannel.id);
      if (!jtcData) {
        return interaction.reply({ embeds: [embed.warn('Not A JTC Channel', 'This command only works in a Join to Create channel.')], ephemeral: true });
      }

      const isOwner = jtcData.ownerId === member.id;

      // ─── CLAIM ───
      if (sub === 'claim') {
        const ownerInChannel = vcChannel.members.has(jtcData.ownerId);
        if (ownerInChannel) return interaction.reply({ embeds: [embed.warn('Cannot Claim', 'The current owner is still in the channel.')], ephemeral: true });
        db.setJtcOwner(vcChannel.id, member.id);
        await vcChannel.permissionOverwrites.edit(member.id, { Connect: true, ManageChannels: true }).catch(() => null);
        return interaction.reply({ embeds: [embed.success('Channel Claimed ⚡', `You are now the owner of **${vcChannel.name}**.`)] });
      }

      // ─── INFO ───
      if (sub === 'info') {
        const members = vcChannel.members.map(m => m.toString()).join(', ') || 'None';
        const owner = await guild.members.fetch(jtcData.ownerId).catch(() => null);
        return interaction.reply({
          embeds: [embed.info('Channel Info', null, [
            { name: '📋 Name', value: vcChannel.name, inline: true },
            { name: '👑 Owner', value: owner?.toString() || `\`${jtcData.ownerId}\``, inline: true },
            { name: '👥 Limit', value: vcChannel.userLimit === 0 ? 'No Limit' : `${vcChannel.userLimit}`, inline: true },
            { name: '🎚️ Bitrate', value: `${vcChannel.bitrate / 1000}kbps`, inline: true },
            { name: '🌍 Region', value: vcChannel.rtcRegion || 'Auto', inline: true },
            { name: '👤 Members', value: members }
          ])],
          ephemeral: true
        });
      }

      // All other commands require ownership
      if (!isOwner) {
        return interaction.reply({ embeds: [embed.danger('Not Owner', 'Only the channel owner can use this.')], ephemeral: true });
      }

      if (sub === 'name') {
        const newName = interaction.options.getString('new_name');
        await vcChannel.setName(newName);
        return interaction.reply({ embeds: [embed.success('Renamed ✏️', `Channel renamed to **${newName}**.`)] });
      }

      if (sub === 'limit') {
        const limit = interaction.options.getInteger('number');
        await vcChannel.setUserLimit(limit);
        return interaction.reply({ embeds: [embed.success('Limit Set 👥', `User limit set to **${limit === 0 ? 'Unlimited' : limit}**.`)] });
      }

      if (sub === 'lock') {
        await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
        return interaction.reply({ embeds: [embed.danger('Channel Locked 🔒', 'No one new can join your channel.')] });
      }

      if (sub === 'unlock') {
        await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: null });
        return interaction.reply({ embeds: [embed.success('Channel Unlocked 🔓', 'Your channel is open for anyone to join.')] });
      }

      if (sub === 'permit') {
        const target = interaction.options.getMember('user');
        await vcChannel.permissionOverwrites.edit(target.id, { Connect: true });
        return interaction.reply({ embeds: [embed.success('User Permitted ✅', `${target} can now join your channel even when locked.`)] });
      }

      if (sub === 'reject') {
        const target = interaction.options.getMember('user');
        if (target.voice?.channelId === vcChannel.id) await target.voice.disconnect().catch(() => null);
        await vcChannel.permissionOverwrites.edit(target.id, { Connect: false });
        return interaction.reply({ embeds: [embed.danger('User Rejected 🚫', `${target} has been removed and cannot rejoin.`)] });
      }

      if (sub === 'transfer') {
        const target = interaction.options.getMember('user');
        if (!vcChannel.members.has(target.id)) {
          return interaction.reply({ embeds: [embed.warn('Not In Channel', 'That user must be in your channel.')], ephemeral: true });
        }
        await vcChannel.permissionOverwrites.edit(member.id, { ManageChannels: false }).catch(() => null);
        await vcChannel.permissionOverwrites.edit(target.id, { Connect: true, ManageChannels: true }).catch(() => null);
        db.setJtcOwner(vcChannel.id, target.id);
        return interaction.reply({ embeds: [embed.success('Ownership Transferred 👑', `${target} is now the owner of this channel.`)] });
      }

      if (sub === 'bitrate') {
        const kbps = interaction.options.getInteger('value');
        await vcChannel.setBitrate(kbps * 1000).catch(() => null);
        return interaction.reply({ embeds: [embed.success('Bitrate Updated 🎚️', `Bitrate set to **${kbps}kbps**.`)] });
      }

      if (sub === 'region') {
        const region = interaction.options.getString('region');
        await vcChannel.setRTCRegion(region || null).catch(() => null);
        return interaction.reply({ embeds: [embed.success('Region Updated 🌍', `Voice region set to **${region || 'Auto'}**.`)] });
      }
    }
  }
];
