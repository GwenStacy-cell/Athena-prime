import {
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder
} from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { isBotOwnerSync } from '../utils/helpers.js';
import fs from 'fs';
import path from 'path';

// Load emoji map (populated by upload-jtc-emojis.mjs)
const EMOJI_MAP_PATH = path.resolve('assets/jtc-emoji-map.json');
let emojiMap = {};
try {
  if (fs.existsSync(EMOJI_MAP_PATH)) {
    emojiMap = JSON.parse(fs.readFileSync(EMOJI_MAP_PATH, 'utf8'));
    console.log(`[JTC] Loaded ${Object.keys(emojiMap).length} custom emojis from emoji map.`);
  }
} catch { /* use text emoji fallback */ }

// Get emoji object for a given key (custom or text fallback)
function getEmoji(key) {
  if (emojiMap[key]?.id) return { id: emojiMap[key].id, name: emojiMap[key].name };
  // Fallback text emoji
  const fallbacks = {
    name: '✏️', limit: '👥', status: '💬', game: '🎮', lfm: '🔍',
    bitrate: '🎚️', region: '🌍', text: '#️⃣', nsfw: '⚠️', claim: '👑',
    lock: '🔒', unlock: '🔓', ghost: '👻', unghost: '👁️',
    permit: '✅', reject: '🚫', invite: '📨', transfer: '⭐'
  };
  return fallbacks[key] || '❔';
}

// ==========================================
// CONTROL PANEL BUILDER (VoiceMaster style)
// Two dropdowns: Channel Settings + Channel Permissions
// ==========================================
export function buildControlPanel(vcChannel, ownerMember) {
  const panelEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('⚙️ Welcome to your own temporary voice channel')
    .setDescription(
      `Control your channel using the menus below\n` +
      `• Use the dropdowns to manage settings and permissions\n` +
      `• Alternatively use \`/vc\` commands\n\n` +
      `**Channel:** ${vcChannel}\n` +
      `**Owner:** ${ownerMember}`
    )
    .setFooter({ text: 'Athena Prime • Join to Create' })
    .setTimestamp();

  // ── Channel Settings Dropdown ──
  const settingsMenu = new StringSelectMenuBuilder()
    .setCustomId('jtc_settings_menu')
    .setPlaceholder('Channel Settings')
    .addOptions([
      { label: 'Name', description: 'Change the channel name', value: 'jtc_name', emoji: getEmoji('name') },
      { label: 'Limit', description: 'Change the channel user limit', value: 'jtc_limit', emoji: getEmoji('limit') },
      { label: 'Status', description: 'Set a custom channel status', value: 'jtc_status', emoji: getEmoji('status') },
      { label: 'Game', description: 'Set channel name to the game you are playing', value: 'jtc_game', emoji: getEmoji('game') },
      { label: 'LFM', description: 'Post a Looking For Members message', value: 'jtc_lfm', emoji: getEmoji('lfm') },
      { label: 'Bitrate', description: 'Change the channel bitrate', value: 'jtc_bitrate', emoji: getEmoji('bitrate') },
      { label: 'Region', description: 'Change the channel voice region', value: 'jtc_region', emoji: getEmoji('region') },
      { label: 'Text', description: 'Create a temporary text channel', value: 'jtc_text', emoji: getEmoji('text') },
      { label: 'NSFW', description: 'Toggle NSFW on your channel', value: 'jtc_nsfw', emoji: getEmoji('nsfw') },
      { label: 'Claim', description: 'Claim ownership of the channel', value: 'jtc_claim', emoji: getEmoji('claim') }
    ]);

  // ── Channel Permissions Dropdown ──
  const permsMenu = new StringSelectMenuBuilder()
    .setCustomId('jtc_perms_menu')
    .setPlaceholder('Channel Permissions')
    .addOptions([
      { label: 'Lock', description: 'Prevent others from joining', value: 'jtc_lock', emoji: getEmoji('lock') },
      { label: 'Unlock', description: 'Reopen the channel to everyone', value: 'jtc_unlock', emoji: getEmoji('unlock') },
      { label: 'Ghost', description: 'Make your channel invisible to others', value: 'jtc_ghost', emoji: getEmoji('ghost') },
      { label: 'Unghost', description: 'Make your channel visible again', value: 'jtc_unghost', emoji: getEmoji('unghost') },
      { label: 'Permit', description: 'Permit a user/role to access the channel', value: 'jtc_permit', emoji: getEmoji('permit') },
      { label: 'Reject', description: 'Reject/kick a user from the channel', value: 'jtc_reject', emoji: getEmoji('reject') },
      { label: 'Invite', description: 'Send a user a DM invite to join', value: 'jtc_invite', emoji: getEmoji('invite') },
      { label: 'Transfer', description: 'Transfer ownership to another user', value: 'jtc_transfer', emoji: getEmoji('transfer') }
    ]);

  const row1 = new ActionRowBuilder().addComponents(settingsMenu);
  const row2 = new ActionRowBuilder().addComponents(permsMenu);

  return { embeds: [panelEmbed], components: [row1, row2] };
}

// ==========================================
// SELECT MENU HANDLER
// ==========================================
export async function handleJtcSelectMenu(interaction) {
  const value = interaction.values[0];
  const member = interaction.member;
  const guild = interaction.guild;

  // Find the user's active JTC channel
  const vcChannel = member.voice?.channel;
  const jtcData = vcChannel ? db.getJtcChannel(vcChannel.id) : null;

  if (!vcChannel || !jtcData) {
    return interaction.reply({
      embeds: [embed.warn('Not In Channel', 'You must be in your JTC voice channel to use the control panel.')],
      ephemeral: true
    });
  }

  // ── CLAIM — anyone in channel can do this ──
  if (value === 'jtc_claim') {
    const ownerInChannel = vcChannel.members.has(jtcData.ownerId);
    if (ownerInChannel) {
      return interaction.reply({ embeds: [embed.warn('Cannot Claim', 'The current owner is still in the channel.')], ephemeral: true });
    }
    db.setJtcOwner(vcChannel.id, member.id);
    await vcChannel.permissionOverwrites.edit(member.id, { Connect: true, ManageChannels: true }).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Channel Claimed ⚡', `You are now the owner of **${vcChannel.name}**.`)] });
  }

  // ── INFO — anyone can view ──
  if (value === 'jtc_info') {
    const members = vcChannel.members.map(m => m.toString()).join(', ') || 'None';
    const owner = await guild.members.fetch(jtcData.ownerId).catch(() => null);
    return interaction.reply({
      embeds: [embed.info('Channel Info ℹ️', null, [
        { name: '📋 Name', value: vcChannel.name, inline: true },
        { name: '👑 Owner', value: owner?.toString() || `\`${jtcData.ownerId}\``, inline: true },
        { name: '👥 Limit', value: vcChannel.userLimit === 0 ? 'No Limit' : `${vcChannel.userLimit}`, inline: true },
        { name: '🎚️ Bitrate', value: `${vcChannel.bitrate / 1000}kbps`, inline: true },
        { name: '🌍 Region', value: vcChannel.rtcRegion || 'Auto', inline: true },
        { name: '⚠️ NSFW', value: vcChannel.nsfw ? 'Yes' : 'No', inline: true },
        { name: '👤 Members In Channel', value: members }
      ])],
      ephemeral: true
    });
  }

  // All other actions require being the owner (bot owner bypasses this)
  const isBotOwner = isBotOwnerSync(member.id);
  if (!isBotOwner && jtcData.ownerId !== member.id) {
    return interaction.reply({ embeds: [embed.danger('Not Owner', 'Only the channel owner can use these controls.')], ephemeral: true });
  }

  // ── DIRECT ACTIONS (no modal needed) ──

  if (value === 'jtc_lock') {
    await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
    return interaction.reply({ embeds: [embed.danger('Channel Locked 🔒', 'No one new can join your channel.')] });
  }

  if (value === 'jtc_unlock') {
    await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: null });
    return interaction.reply({ embeds: [embed.success('Channel Unlocked 🔓', 'Your channel is now open for anyone to join.')] });
  }

  if (value === 'jtc_ghost') {
    await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
    return interaction.reply({ embeds: [embed.info('Channel Hidden 👻', 'Your channel is now invisible to others.\nUsers you permit can still see and join.')] });
  }

  if (value === 'jtc_unghost') {
    await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: null });
    return interaction.reply({ embeds: [embed.success('Channel Visible 👁️', 'Your channel is now visible to everyone again.')] });
  }

  if (value === 'jtc_nsfw') {
    const current = vcChannel.nsfw;
    await vcChannel.setNSFW(!current).catch(() => null);
    return interaction.reply({ embeds: [current ? embed.success('NSFW Disabled', 'Your channel is no longer marked NSFW.') : embed.warn('NSFW Enabled ⚠️', 'Your channel has been marked as NSFW.')] });
  }

  // ── GAME — set channel name to game owner is playing ──
  if (value === 'jtc_game') {
    const ownerMember = await guild.members.fetch(jtcData.ownerId).catch(() => null);
    const activity = ownerMember?.presence?.activities?.find(a => a.type === 0); // 0 = Playing
    if (!activity) {
      return interaction.reply({ embeds: [embed.warn('No Game Detected', 'You must be playing a game with rich presence enabled for this to work.')], ephemeral: true });
    }
    await vcChannel.setName(activity.name).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Game Set 🎮', `Channel renamed to **${activity.name}**.`)] });
  }

  // ── LFM — post Looking For Members message ──
  if (value === 'jtc_lfm') {
    const lfmEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🔍 Looking for Members!')
      .setDescription(`**${member.displayName}** is looking for members to join their voice channel!\n\n**Channel:** ${vcChannel}\n**Slots Available:** ${vcChannel.userLimit === 0 ? 'Unlimited' : vcChannel.userLimit - vcChannel.members.size}`)
      .setFooter({ text: 'Join their channel to play together!' })
      .setTimestamp();
    await interaction.channel.send({ embeds: [lfmEmbed] }).catch(() => null);
    return interaction.reply({ embeds: [embed.success('LFM Posted 🔍', 'Your Looking for Members message has been posted in this channel.')], ephemeral: true });
  }

  // ── TEXT — create a temp text channel linked to VC ──
  if (value === 'jtc_text') {
    const jtcCfg = db.getJtcConfig(guild.id);
    const existing = guild.channels.cache.find(c => c.name === `${vcChannel.name}-text` && c.parentId === (jtcCfg?.categoryId || vcChannel.parentId));
    if (existing) {
      return interaction.reply({ embeds: [embed.warn('Already Exists', `A text channel already exists: ${existing}`)], ephemeral: true });
    }
    const textCh = await guild.channels.create({
      name: `${vcChannel.name.toLowerCase().replace(/\s+/g, '-')}-text`,
      type: ChannelType.GuildText,
      parent: jtcCfg?.categoryId || vcChannel.parentId || null,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
      ],
      reason: `JTC Temp Text for ${member.user.tag}`
    });
    // Grant access to all current VC members
    for (const [, m] of vcChannel.members) {
      await textCh.permissionOverwrites.edit(m.id, { ViewChannel: true, SendMessages: true }).catch(() => null);
    }
    return interaction.reply({ embeds: [embed.success('Text Channel Created #️⃣', `Temporary text channel created: ${textCh}\n\nIt is only visible to members in your voice channel.`)] });
  }

  // ── MODAL-BASED ACTIONS ──
  const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');

  if (value === 'jtc_name') {
    const modal = new ModalBuilder().setCustomId('jtc_rename_modal').setTitle('Rename Your Channel');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('jtc_new_name').setLabel('New Channel Name')
        .setStyle(TextInputStyle.Short).setPlaceholder('e.g. Chill Zone').setRequired(true).setMaxLength(100)
    ));
    return interaction.showModal(modal);
  }

  if (value === 'jtc_limit') {
    const modal = new ModalBuilder().setCustomId('jtc_limit_modal').setTitle('Set User Limit');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('jtc_limit_val').setLabel('User Limit (0 = unlimited, max 99)')
        .setStyle(TextInputStyle.Short).setPlaceholder('e.g. 5').setRequired(true).setMaxLength(2)
    ));
    return interaction.showModal(modal);
  }

  if (value === 'jtc_status') {
    const modal = new ModalBuilder().setCustomId('jtc_status_modal').setTitle('Set Channel Status');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('jtc_status_val').setLabel('Channel Status')
        .setStyle(TextInputStyle.Short).setPlaceholder('e.g. Playing Valorant 🎮').setRequired(true).setMaxLength(500)
    ));
    return interaction.showModal(modal);
  }

  if (value === 'jtc_bitrate') {
    const modal = new ModalBuilder().setCustomId('jtc_bitrate_modal').setTitle('Set Bitrate');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('jtc_bitrate_val').setLabel('Bitrate in kbps (8 - 384)')
        .setStyle(TextInputStyle.Short).setPlaceholder('e.g. 128').setRequired(true).setMaxLength(3)
    ));
    return interaction.showModal(modal);
  }

  if (value === 'jtc_region') {
    const modal = new ModalBuilder().setCustomId('jtc_region_modal').setTitle('Set Voice Region');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('jtc_region_val')
        .setLabel('Region (leave blank for Auto)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('brazil / europe / india / japan / singapore / us-east / us-west ...')
        .setRequired(false).setMaxLength(20)
    ));
    return interaction.showModal(modal);
  }

  if (value === 'jtc_permit') {
    const modal = new ModalBuilder().setCustomId('jtc_permit_modal').setTitle('Permit a User');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('jtc_permit_userid').setLabel('User ID to permit')
        .setStyle(TextInputStyle.Short).setPlaceholder('Right-click user → Copy ID').setRequired(true)
    ));
    return interaction.showModal(modal);
  }

  if (value === 'jtc_reject') {
    const modal = new ModalBuilder().setCustomId('jtc_reject_modal').setTitle('Reject a User');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('jtc_reject_userid').setLabel('User ID to reject/kick')
        .setStyle(TextInputStyle.Short).setPlaceholder('Right-click user → Copy ID').setRequired(true)
    ));
    return interaction.showModal(modal);
  }

  if (value === 'jtc_invite') {
    const modal = new ModalBuilder().setCustomId('jtc_invite_modal').setTitle('Invite a User');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('jtc_invite_userid').setLabel('User ID to invite via DM')
        .setStyle(TextInputStyle.Short).setPlaceholder('Right-click user → Copy ID').setRequired(true)
    ));
    return interaction.showModal(modal);
  }

  if (value === 'jtc_transfer') {
    const modal = new ModalBuilder().setCustomId('jtc_transfer_modal').setTitle('Transfer Ownership');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('jtc_transfer_userid').setLabel('New Owner User ID (must be in channel)')
        .setStyle(TextInputStyle.Short).setPlaceholder('Right-click user → Copy ID').setRequired(true)
    ));
    return interaction.showModal(modal);
  }
}

// ==========================================
// MODAL HANDLER
// ==========================================
export async function handleJtcModal(interaction) {
  const customId = interaction.customId;
  const member = interaction.member;
  const guild = interaction.guild;
  const vcChannel = member.voice?.channel;
  const jtcData = vcChannel ? db.getJtcChannel(vcChannel.id) : null;

  const isBotOwner = isBotOwnerSync(member.id);
  if (!jtcData || (!isBotOwner && jtcData.ownerId !== member.id)) {
    return interaction.reply({ embeds: [embed.danger('Not Owner', 'You are not the owner of this channel.')], ephemeral: true });
  }

  if (customId === 'jtc_rename_modal') {
    const newName = interaction.fields.getTextInputValue('jtc_new_name').trim();
    await vcChannel.setName(newName).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Channel Renamed ✏️', `Your channel has been renamed to **${newName}**.`)] });
  }

  if (customId === 'jtc_limit_modal') {
    const val = parseInt(interaction.fields.getTextInputValue('jtc_limit_val')) || 0;
    const limit = Math.min(Math.max(val, 0), 99);
    await vcChannel.setUserLimit(limit).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Limit Updated 👥', `User limit set to **${limit === 0 ? 'Unlimited' : limit}**.`)] });
  }

  if (customId === 'jtc_status_modal') {
    const status = interaction.fields.getTextInputValue('jtc_status_val').trim();
    // Discord.js channel status (voice channel status)
    await vcChannel.setStatus(status).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Status Set 💬', `Channel status set to: **${status}**`)] });
  }

  if (customId === 'jtc_bitrate_modal') {
    const kbps = Math.min(Math.max(parseInt(interaction.fields.getTextInputValue('jtc_bitrate_val')) || 64, 8), 384);
    await vcChannel.setBitrate(kbps * 1000).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Bitrate Updated 🎚️', `Bitrate set to **${kbps}kbps**.`)] });
  }

  if (customId === 'jtc_region_modal') {
    const region = interaction.fields.getTextInputValue('jtc_region_val').trim().toLowerCase() || null;
    await vcChannel.setRTCRegion(region).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Region Updated 🌍', `Voice region set to **${region || 'Auto'}**.`)] });
  }

  if (customId === 'jtc_permit_modal') {
    const userId = interaction.fields.getTextInputValue('jtc_permit_userid').trim().replace(/\D/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return interaction.reply({ embeds: [embed.warn('User Not Found', 'Could not find that user in this server.')], ephemeral: true });
    await vcChannel.permissionOverwrites.edit(userId, { Connect: true, ViewChannel: true });
    return interaction.reply({ embeds: [embed.success('User Permitted ✅', `${target} can now join your channel even when locked or ghosted.`)] });
  }

  if (customId === 'jtc_reject_modal') {
    const userId = interaction.fields.getTextInputValue('jtc_reject_userid').trim().replace(/\D/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return interaction.reply({ embeds: [embed.warn('User Not Found', 'Could not find that user.')], ephemeral: true });
    if (target.voice?.channelId === vcChannel.id) await target.voice.disconnect().catch(() => null);
    await vcChannel.permissionOverwrites.edit(userId, { Connect: false, ViewChannel: false });
    return interaction.reply({ embeds: [embed.danger('User Rejected 🚫', `${target} has been removed and banned from your channel.`)] });
  }

  if (customId === 'jtc_invite_modal') {
    const userId = interaction.fields.getTextInputValue('jtc_invite_userid').trim().replace(/\D/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return interaction.reply({ embeds: [embed.warn('User Not Found', 'Could not find that user.')], ephemeral: true });

    // Create a temp invite link for the VC
    const invite = await vcChannel.createInvite({ maxAge: 300, maxUses: 1, reason: 'JTC Invite' }).catch(() => null);
    const dmEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📨 You\'ve been invited!')
      .setDescription(`**${member.displayName}** has invited you to join their voice channel in **${guild.name}**.\n\n**Channel:** ${vcChannel.name}\n\n${invite ? `[Click to Join](${invite.url})` : 'Join the server and look for their channel.'}`)
      .setFooter({ text: 'Athena Prime • Join to Create' });

    const dmSent = await target.send({ embeds: [dmEmbed] }).catch(() => null);
    if (!dmSent) return interaction.reply({ embeds: [embed.warn('DM Failed', `Could not send a DM to ${target}. They may have DMs disabled.`)], ephemeral: true });
    return interaction.reply({ embeds: [embed.success('Invite Sent 📨', `${target} has been invited to your channel via DM.`)] });
  }

  if (customId === 'jtc_transfer_modal') {
    const userId = interaction.fields.getTextInputValue('jtc_transfer_userid').trim().replace(/\D/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return interaction.reply({ embeds: [embed.warn('User Not Found', 'Could not find that user.')], ephemeral: true });
    if (!vcChannel.members.has(userId)) return interaction.reply({ embeds: [embed.warn('Not In Channel', 'That user must be in your channel to receive ownership.')], ephemeral: true });
    await vcChannel.permissionOverwrites.edit(member.id, { ManageChannels: false }).catch(() => null);
    await vcChannel.permissionOverwrites.edit(userId, { Connect: true, ViewChannel: true, ManageChannels: true }).catch(() => null);
    db.setJtcOwner(vcChannel.id, userId);
    return interaction.reply({ embeds: [embed.success('Ownership Transferred 👑', `${target} is now the owner of this channel.`)] });
  }
}

// ==========================================
// SLASH COMMANDS
// ==========================================
export const commands = [
  // ─── JTCSETUP ───
  {
    name: 'jtcsetup',
    description: '⚙️ Set up the Join to Create system. (Admin only)',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [
      { name: 'channel', description: 'Existing VC to use as lobby (leave empty to auto-create)', type: 7, required: false, channel_types: [2] },
      { name: 'category', description: 'Category for temp channels (leave empty to use lobby\'s category)', type: 7, required: false, channel_types: [4] },
      { name: 'panel_channel', description: 'Text channel to send control panels to (leave empty = VC text chat)', type: 7, required: false, channel_types: [0] }
    ],
    async executePrefix(message) {
      return message.reply({ embeds: [embed.info('Use Slash Command', 'Please use `/jtcsetup` for this command.')] });
    },
    async executeSlash(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;

      let lobbyChannel = interaction.options.getChannel('channel');
      let category = interaction.options.getChannel('category');
      const panelChannel = interaction.options.getChannel('panel_channel');

      if (!lobbyChannel) {
        const cat = await guild.channels.create({ name: '🎙️ Voice Rooms', type: ChannelType.GuildCategory, reason: 'Athena Prime JTC Setup' });
        lobbyChannel = await guild.channels.create({ name: '➕ Join to Create', type: ChannelType.GuildVoice, parent: cat.id, reason: 'Athena Prime JTC Setup' });
        category = cat;
      }

      const categoryId = category?.id || lobbyChannel.parentId;
      const panelChannelId = panelChannel?.id || null;
      db.setJtcConfig(guild.id, lobbyChannel.id, categoryId, panelChannelId);

      await interaction.editReply({
        embeds: [embed.success('JTC System Activated ✅', [
          `**Lobby Channel:** ${lobbyChannel}`,
          `**Category:** ${categoryId ? `<#${categoryId}>` : 'Same as lobby'}`,
          `**Panel Channel:** ${panelChannelId ? `<#${panelChannelId}>` : 'VC Text Chat (default)'}`,
          '',
          'When someone joins the lobby, a private voice channel and control panel will be created automatically.',
          'To disable: `/jtcdisable`'
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

  // ─── VC SLASH COMMANDS ───
  {
    name: 'vc',
    description: '🎙️ Manage your personal JTC voice channel.',
    category: 'utility',
    permissions: [],
    options: [
      { name: 'name', description: 'Rename your voice channel', type: 1, options: [{ name: 'new_name', description: 'The new name', type: 3, required: true }] },
      { name: 'limit', description: 'Set user limit (0 = unlimited)', type: 1, options: [{ name: 'number', description: 'Max users (0-99)', type: 4, required: true, min_value: 0, max_value: 99 }] },
      { name: 'lock', description: 'Prevent others from joining', type: 1 },
      { name: 'unlock', description: 'Reopen the channel', type: 1 },
      { name: 'ghost', description: 'Hide your channel from everyone', type: 1 },
      { name: 'unghost', description: 'Make your channel visible again', type: 1 },
      { name: 'permit', description: 'Permit a user to access the channel', type: 1, options: [{ name: 'user', description: 'User to permit', type: 6, required: true }] },
      { name: 'reject', description: 'Reject/kick a user from the channel', type: 1, options: [{ name: 'user', description: 'User to reject', type: 6, required: true }] },
      { name: 'invite', description: 'Invite a user via DM', type: 1, options: [{ name: 'user', description: 'User to invite', type: 6, required: true }] },
      { name: 'transfer', description: 'Transfer ownership to another member', type: 1, options: [{ name: 'user', description: 'New owner (must be in channel)', type: 6, required: true }] },
      { name: 'bitrate', description: 'Change channel bitrate (kbps)', type: 1, options: [{ name: 'value', description: 'Bitrate in kbps (8-384)', type: 4, required: true, min_value: 8, max_value: 384 }] },
      { name: 'region', description: 'Change voice region', type: 1, options: [{ name: 'region', description: 'Voice region', type: 3, required: true, choices: [{ name: 'Auto', value: '' }, { name: 'Brazil', value: 'brazil' }, { name: 'Europe', value: 'europe' }, { name: 'Hong Kong', value: 'hongkong' }, { name: 'India', value: 'india' }, { name: 'Japan', value: 'japan' }, { name: 'Singapore', value: 'singapore' }, { name: 'US East', value: 'us-east' }, { name: 'US West', value: 'us-west' }, { name: 'US Central', value: 'us-central' }, { name: 'US South', value: 'us-south' }, { name: 'Sydney', value: 'sydney' }, { name: 'South Africa', value: 'southafrica' }, { name: 'Russia', value: 'russia' }] }] },
      { name: 'nsfw', description: 'Toggle NSFW on your channel', type: 1 },
      { name: 'claim', description: 'Claim ownership if owner left', type: 1 },
      { name: 'info', description: 'Show channel details', type: 1 }
    ],
    async executePrefix(message) {
      return message.reply({ embeds: [embed.info('Use Slash Command', 'Please use `/vc` for voice channel management.')] });
    },
    async executeSlash(interaction) {
      const sub = interaction.options.getSubcommand();
      const member = interaction.member;
      const guild = interaction.guild;
      const vcChannel = member.voice?.channel;

      if (!vcChannel) return interaction.reply({ embeds: [embed.warn('Not In Voice', 'You must be in a voice channel to use this.')], ephemeral: true });
      const jtcData = db.getJtcChannel(vcChannel.id);
      if (!jtcData) return interaction.reply({ embeds: [embed.warn('Not A JTC Channel', 'This only works in a Join to Create channel.')], ephemeral: true });
      const isOwner = jtcData.ownerId === member.id || isBotOwnerSync(member.id);

      if (sub === 'claim') {
        if (vcChannel.members.has(jtcData.ownerId)) return interaction.reply({ embeds: [embed.warn('Cannot Claim', 'The owner is still in the channel.')], ephemeral: true });
        db.setJtcOwner(vcChannel.id, member.id);
        await vcChannel.permissionOverwrites.edit(member.id, { Connect: true, ManageChannels: true }).catch(() => null);
        return interaction.reply({ embeds: [embed.success('Claimed ⚡', `You are now the owner of **${vcChannel.name}**.`)] });
      }

      if (sub === 'info') {
        const owner = await guild.members.fetch(jtcData.ownerId).catch(() => null);
        return interaction.reply({ embeds: [embed.info('Channel Info', null, [
          { name: '📋 Name', value: vcChannel.name, inline: true },
          { name: '👑 Owner', value: owner?.toString() || `\`${jtcData.ownerId}\``, inline: true },
          { name: '👥 Limit', value: vcChannel.userLimit === 0 ? 'Unlimited' : `${vcChannel.userLimit}`, inline: true },
          { name: '🎚️ Bitrate', value: `${vcChannel.bitrate / 1000}kbps`, inline: true },
          { name: '🌍 Region', value: vcChannel.rtcRegion || 'Auto', inline: true },
          { name: '⚠️ NSFW', value: vcChannel.nsfw ? 'Yes' : 'No', inline: true }
        ])], ephemeral: true });
      }

      if (!isOwner) return interaction.reply({ embeds: [embed.danger('Not Owner', 'Only the channel owner can do this.')], ephemeral: true });

      if (sub === 'name') { await vcChannel.setName(interaction.options.getString('new_name')); return interaction.reply({ embeds: [embed.success('Renamed ✏️', `Channel renamed to **${interaction.options.getString('new_name')}**.`)] }); }
      if (sub === 'limit') { const l = interaction.options.getInteger('number'); await vcChannel.setUserLimit(l); return interaction.reply({ embeds: [embed.success('Limit Set 👥', `Limit set to **${l === 0 ? 'Unlimited' : l}**.`)] }); }
      if (sub === 'lock') { await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false }); return interaction.reply({ embeds: [embed.danger('Locked 🔒', 'Channel is now locked.')] }); }
      if (sub === 'unlock') { await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: null }); return interaction.reply({ embeds: [embed.success('Unlocked 🔓', 'Channel is now open.')] }); }
      if (sub === 'ghost') { await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }); return interaction.reply({ embeds: [embed.info('Ghosted 👻', 'Channel is now invisible.')] }); }
      if (sub === 'unghost') { await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: null }); return interaction.reply({ embeds: [embed.success('Unghostd 👁️', 'Channel is now visible.')] }); }
      if (sub === 'nsfw') { const c = vcChannel.nsfw; await vcChannel.setNSFW(!c); return interaction.reply({ embeds: [c ? embed.success('NSFW Off', 'Channel is no longer NSFW.') : embed.warn('NSFW On ⚠️', 'Channel marked as NSFW.')] }); }
      if (sub === 'bitrate') { const k = interaction.options.getInteger('value'); await vcChannel.setBitrate(k * 1000); return interaction.reply({ embeds: [embed.success('Bitrate 🎚️', `Set to **${k}kbps**.`)] }); }
      if (sub === 'region') { const r = interaction.options.getString('region'); await vcChannel.setRTCRegion(r || null); return interaction.reply({ embeds: [embed.success('Region 🌍', `Set to **${r || 'Auto'}**.`)] }); }

      if (sub === 'permit') {
        const t = interaction.options.getMember('user');
        await vcChannel.permissionOverwrites.edit(t.id, { Connect: true, ViewChannel: true });
        return interaction.reply({ embeds: [embed.success('Permitted ✅', `${t} can now join.`)] });
      }
      if (sub === 'reject') {
        const t = interaction.options.getMember('user');
        if (t.voice?.channelId === vcChannel.id) await t.voice.disconnect().catch(() => null);
        await vcChannel.permissionOverwrites.edit(t.id, { Connect: false, ViewChannel: false });
        return interaction.reply({ embeds: [embed.danger('Rejected 🚫', `${t} has been removed.`)] });
      }
      if (sub === 'invite') {
        const t = interaction.options.getMember('user');
        const inv = await vcChannel.createInvite({ maxAge: 300, maxUses: 1 }).catch(() => null);
        const dmEmbed = new EmbedBuilder().setColor(0x5865F2).setTitle('📨 You\'ve been invited!').setDescription(`**${member.displayName}** invites you to join their channel in **${guild.name}**.\n\n${inv ? `[Click to Join](${inv.url})` : 'Look for their channel!'}`);
        const sent = await t.send({ embeds: [dmEmbed] }).catch(() => null);
        return interaction.reply({ embeds: [sent ? embed.success('Invite Sent 📨', `${t} has been invited via DM.`) : embed.warn('DM Failed', `${t} has DMs disabled.`)], ephemeral: true });
      }
      if (sub === 'transfer') {
        const t = interaction.options.getMember('user');
        if (!vcChannel.members.has(t.id)) return interaction.reply({ embeds: [embed.warn('Not In Channel', 'That user must be in your channel.')], ephemeral: true });
        await vcChannel.permissionOverwrites.edit(member.id, { ManageChannels: false }).catch(() => null);
        await vcChannel.permissionOverwrites.edit(t.id, { Connect: true, ViewChannel: true, ManageChannels: true }).catch(() => null);
        db.setJtcOwner(vcChannel.id, t.id);
        return interaction.reply({ embeds: [embed.success('Transferred 👑', `${t} is now the owner.`)] });
      }
    }
  }
];
