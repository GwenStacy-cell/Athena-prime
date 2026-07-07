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
import { fileURLToPath } from 'url';

// Resolve project root from src/commands/jtc.js → ../../
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Load emoji map (populated by upload-jtc-emojis.mjs)
const EMOJI_MAP_PATH = path.join(PROJECT_ROOT, 'assets', 'jtc-emoji-map.json');
let emojiMap = {};
try {
  if (fs.existsSync(EMOJI_MAP_PATH)) {
    emojiMap = JSON.parse(fs.readFileSync(EMOJI_MAP_PATH, 'utf8'));
    console.log(`[JTC]  Loaded ${Object.keys(emojiMap).length} custom emojis. Path: ${EMOJI_MAP_PATH}`);
  } else {
    console.warn(`[JTC]   Emoji map not found at: ${EMOJI_MAP_PATH}`);
  }
} catch (e) {
  console.error('[JTC] Failed to load emoji map:', e.message);
}

// Get emoji object for a given key (custom or text fallback)
function getEmoji(key) {
  if (emojiMap[key]?.id) return { id: emojiMap[key].id, name: emojiMap[key].name };
  // Fallback text emoji
  const fallbacks = {
    name: '', limit: '�', status: '�', game: '�', lfm: '�',
    bitrate: '�', region: '�', text: '#⃣', nsfw: '', claim: '',
    lock: '�', unlock: '�', ghost: '�', unghost: '�',
    permit: '', reject: '', invite: '', transfer: ''
  };
  return fallbacks[key] || '';
}

function getAccent(guildId) {
  if (!guildId) return 0x5865F2;
  const cfg = db.getGuildConfig(guildId);
  return cfg?.accentColor ? parseInt(cfg.accentColor.replace('#', ''), 16) : 0x5865F2;
}

// ==========================================
// CONTROL PANEL BUILDER (VoiceMaster style)
// Two dropdowns: Channel Settings + Channel Permissions
// ==========================================
export function buildControlPanel(vcChannel, ownerMember) {
  const panelEmbed = new EmbedBuilder()
    .setColor(getAccent(vcChannel.guild.id))
    .setTitle(' Welcome to your own temporary voice channel')
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
      { label: 'Claim', description: 'Claim ownership of the channel', value: 'jtc_claim', emoji: getEmoji('claim') },
      { label: 'Info', description: 'Show channel details', value: 'jtc_info', emoji: 'ℹ' }
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
// SHARED PANEL — one persistent message in the interface channel
// Generic, no channel/owner info. All interactions are ephemeral.
// ==========================================
export function buildSharedPanel(guildId) {
  const panelEmbed = new EmbedBuilder()
    .setColor(getAccent(guildId))
    .setTitle(' Voice Channel Control Panel')
    .setDescription(
      `**Manage your temporary voice channel using the menus below.**\n\n` +
      `• Join the ** Join to Create** lobby first\n` +
      `• Use the dropdowns to control your room\n` +
      `• Alternatively use \`/vc\` slash commands\n\n` +
      `> � Only **you** can see the responses — fully private.`
    )
    .setFooter({ text: 'Athena Prime • Join to Create' });

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
      { label: 'Claim', description: 'Claim ownership of the channel', value: 'jtc_claim', emoji: getEmoji('claim') },
      { label: 'Info', description: 'Show channel details', value: 'jtc_info', emoji: 'ℹ' }
    ]);

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
    return interaction.reply({ embeds: [embed.success('Channel Claimed ', `You are now the owner of **${vcChannel.name}**.`)], ephemeral: true });
  }

  // ── INFO — anyone can view ──
  if (value === 'jtc_info') {
    const members = vcChannel.members.map(m => m.toString()).join(', ') || 'None';
    const owner = await guild.members.fetch(jtcData.ownerId).catch(() => null);
    return interaction.reply({
      embeds: [embed.info('Channel Info ℹ', null, [
        { name: '� Name', value: vcChannel.name, inline: true },
        { name: ' Owner', value: owner?.toString() || `\`${jtcData.ownerId}\``, inline: true },
        { name: '� Limit', value: vcChannel.userLimit === 0 ? 'No Limit' : `${vcChannel.userLimit}`, inline: true },
        { name: '� Bitrate', value: `${vcChannel.bitrate / 1000}kbps`, inline: true },
        { name: '� Region', value: vcChannel.rtcRegion || 'Auto', inline: true },
        { name: ' NSFW', value: vcChannel.nsfw ? 'Yes' : 'No', inline: true },
        { name: '� Members In Channel', value: members }
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
    return interaction.reply({ embeds: [embed.danger('Channel Locked �', 'No one new can join your channel.')], ephemeral: true });
  }

  if (value === 'jtc_unlock') {
    await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: null });
    return interaction.reply({ embeds: [embed.success('Channel Unlocked �', 'Your channel is now open for anyone to join.')], ephemeral: true });
  }

  if (value === 'jtc_ghost') {
    await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
    return interaction.reply({ embeds: [embed.info('Channel Hidden �', 'Your channel is now invisible to others.\nUsers you permit can still see and join.')], ephemeral: true });
  }

  if (value === 'jtc_unghost') {
    await vcChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: null });
    return interaction.reply({ embeds: [embed.success('Channel Visible �', 'Your channel is now visible to everyone again.')], ephemeral: true });
  }

  if (value === 'jtc_nsfw') {
    const current = vcChannel.nsfw;
    await vcChannel.setNSFW(!current).catch(() => null);
    return interaction.reply({ embeds: [current ? embed.success('NSFW Disabled', 'Your channel is no longer marked NSFW.') : embed.warn('NSFW Enabled ', 'Your channel has been marked as NSFW.')], ephemeral: true });
  }

  // ── GAME — set channel name to game owner is playing ──
  if (value === 'jtc_game') {
    const ownerMember = await guild.members.fetch(jtcData.ownerId).catch(() => null);
    const activity = ownerMember?.presence?.activities?.find(a => a.type === 0); // 0 = Playing
    if (!activity) {
      return interaction.reply({ embeds: [embed.warn('No Game Detected', 'You must be playing a game with rich presence enabled for this to work.')], ephemeral: true });
    }
    await vcChannel.setName(activity.name).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Game Set �', `Channel renamed to **${activity.name}**.`)], ephemeral: true });
  }

  // ── LFM — post Looking For Members message ──
  if (value === 'jtc_lfm') {
    const lfmEmbed = new EmbedBuilder()
      .setColor(getAccent(guild.id))
      .setTitle('� Looking for Members!')
      .setDescription(`**${member.displayName}** is looking for members to join their voice channel!\n\n**Channel:** ${vcChannel}\n**Slots Available:** ${vcChannel.userLimit === 0 ? 'Unlimited' : vcChannel.userLimit - vcChannel.members.size}`)
      .setFooter({ text: 'Join their channel to play together!' })
      .setTimestamp();
    await interaction.channel.send({ embeds: [lfmEmbed] }).catch(() => null);
    return interaction.reply({ embeds: [embed.success('LFM Posted �', 'Your Looking for Members message has been posted in this channel.')], ephemeral: true });
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
    // Link text channel to VC in DB
    db.setJtcTextChannel(vcChannel.id, textCh.id);

    // Grant access to all current VC members
    for (const [, m] of vcChannel.members) {
      await textCh.permissionOverwrites.edit(m.id, { ViewChannel: true, SendMessages: true }).catch(() => null);
    }
    return interaction.reply({ embeds: [embed.success('Text Channel Created #⃣', `Temporary text channel created: ${textCh}

It is only visible to members in your voice channel.`)], ephemeral: true });
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
        .setStyle(TextInputStyle.Short).setPlaceholder('e.g. Playing Valorant �').setRequired(true).setMaxLength(500)
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
    return interaction.reply({ embeds: [embed.success('Channel Renamed ', `Your channel has been renamed to **${newName}**.`)], ephemeral: true });
  }

  if (customId === 'jtc_limit_modal') {
    const val = parseInt(interaction.fields.getTextInputValue('jtc_limit_val')) || 0;
    const limit = Math.min(Math.max(val, 0), 99);
    await vcChannel.setUserLimit(limit).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Limit Updated �', `User limit set to **${limit === 0 ? 'Unlimited' : limit}**.`)], ephemeral: true });
  }

  if (customId === 'jtc_status_modal') {
    const status = interaction.fields.getTextInputValue('jtc_status_val').trim();
    await interaction.client.rest.put(`/channels/${vcChannel.id}/voice-status`, { body: { status } }).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Status Set �', `Channel status set to: **${status}**`)], ephemeral: true });
  }

  if (customId === 'jtc_bitrate_modal') {
    const kbps = Math.min(Math.max(parseInt(interaction.fields.getTextInputValue('jtc_bitrate_val')) || 64, 8), 384);
    await vcChannel.setBitrate(kbps * 1000).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Bitrate Updated �', `Bitrate set to **${kbps}kbps**.`)], ephemeral: true });
  }

  if (customId === 'jtc_region_modal') {
    const region = interaction.fields.getTextInputValue('jtc_region_val').trim().toLowerCase() || null;
    await vcChannel.setRTCRegion(region).catch(() => null);
    return interaction.reply({ embeds: [embed.success('Region Updated �', `Voice region set to **${region || 'Auto'}**.`)], ephemeral: true });
  }

  if (customId === 'jtc_permit_modal') {
    const userId = interaction.fields.getTextInputValue('jtc_permit_userid').trim().replace(/\D/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return interaction.reply({ embeds: [embed.warn('User Not Found', 'Could not find that user in this server.')], ephemeral: true });
    await vcChannel.permissionOverwrites.edit(userId, { Connect: true, ViewChannel: true });
    return interaction.reply({ embeds: [embed.success('User Permitted ', `${target} can now join your channel even when locked or ghosted.`)], ephemeral: true });
  }

  if (customId === 'jtc_reject_modal') {
    const userId = interaction.fields.getTextInputValue('jtc_reject_userid').trim().replace(/\D/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return interaction.reply({ embeds: [embed.warn('User Not Found', 'Could not find that user.')], ephemeral: true });
    if (target.voice?.channelId === vcChannel.id) await target.voice.disconnect().catch(() => null);
    await vcChannel.permissionOverwrites.edit(userId, { Connect: false, ViewChannel: false });
    return interaction.reply({ embeds: [embed.danger('User Rejected ', `${target} has been removed and banned from your channel.`)], ephemeral: true });
  }

  if (customId === 'jtc_invite_modal') {
    const userId = interaction.fields.getTextInputValue('jtc_invite_userid').trim().replace(/\D/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return interaction.reply({ embeds: [embed.warn('User Not Found', 'Could not find that user.')], ephemeral: true });

    const invite = await vcChannel.createInvite({ maxAge: 300, maxUses: 1, reason: 'JTC Invite' }).catch(() => null);
    const dmEmbed = new EmbedBuilder()
      .setColor(getAccent(guild.id))
      .setTitle(' You\'ve been invited!')
      .setDescription(`**${member.displayName}** has invited you to join their voice channel in **${guild.name}**.\n\n**Channel:** ${vcChannel.name}\n\n${invite ? `[Click to Join](${invite.url})` : 'Join the server and look for their channel.'}`)
      .setFooter({ text: 'Athena Prime • Join to Create' });

    const dmSent = await target.send({ embeds: [dmEmbed] }).catch(() => null);
    if (!dmSent) return interaction.reply({ embeds: [embed.warn('DM Failed', `Could not send a DM to ${target}. They may have DMs disabled.`)], ephemeral: true });
    return interaction.reply({ embeds: [embed.success('Invite Sent ', `${target} has been invited to your channel via DM.`)], ephemeral: true });
  }

  if (customId === 'jtc_transfer_modal') {
    const userId = interaction.fields.getTextInputValue('jtc_transfer_userid').trim().replace(/\D/g, '');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return interaction.reply({ embeds: [embed.warn('User Not Found', 'Could not find that user.')], ephemeral: true });
    if (!vcChannel.members.has(userId)) return interaction.reply({ embeds: [embed.warn('Not In Channel', 'That user must be in your channel to receive ownership.')], ephemeral: true });
    await vcChannel.permissionOverwrites.edit(member.id, { ManageChannels: false }).catch(() => null);
    await vcChannel.permissionOverwrites.edit(userId, { Connect: true, ViewChannel: true, ManageChannels: true }).catch(() => null);
    db.setJtcOwner(vcChannel.id, userId);
    return interaction.reply({ embeds: [embed.success('Ownership Transferred ', `${target} is now the owner of this channel.`)], ephemeral: true });
  }
}

// ==========================================
// SLASH COMMANDS
// ==========================================
export const commands = [
  // ─── JTCSETUP ───
  {
    name: 'jtcsetup',
    description: 'Set up the Join to Create system. (Admin only)',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [
      { name: 'channel', description: 'Select VC lobby (or use channel_id)', type: 7, required: false, channel_types: [2] },
      { name: 'channel_id', description: 'Or paste VC lobby ID here', type: 3, required: false },
      { name: 'category', description: 'Select Category (or use category_id)', type: 7, required: false, channel_types: [4] },
      { name: 'category_id', description: 'Or paste Category ID here', type: 3, required: false },
      { name: 'panel_channel', description: 'Select Panel text channel (or use panel_id)', type: 7, required: false, channel_types: [0] },
      { name: 'panel_id', description: 'Or paste Panel text channel ID here', type: 3, required: false }
    ],
    async executePrefix(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isBotOwnerSync(message.author.id)) return;
      const guild = message.guild;

      let lobbyChannel = null;
      let category = null;
      let panelChannel = null;

      for (const arg of args) {
        const id = arg.replace(/\D/g, '');
        if (!id) continue;
        const channel = await guild.channels.fetch(id).catch(() => null);
        if (!channel) continue;

        if (channel.isVoiceBased()) {
          lobbyChannel = channel;
        } else if (channel.type === 4) { // GuildCategory
          category = channel;
        } else if (channel.isTextBased()) {
          panelChannel = channel;
        }
      }

      if (!lobbyChannel && !category && !panelChannel && args.length > 0) {
         return message.reply({ embeds: [embed.warn('Invalid ID', 'None of the provided IDs resolved to a valid channel in this server. Please check the IDs and try again.')] });
      }

      if (!lobbyChannel) {
        const cat = await guild.channels.create({ name: '➕ Voice Rooms', type: ChannelType.GuildCategory, reason: 'Athena Prime JTC Setup' });
        lobbyChannel = await guild.channels.create({ name: '➕ Join to Create', type: ChannelType.GuildVoice, parent: cat.id, reason: 'Athena Prime JTC Setup' });
        category = cat;
      }

      const categoryId = category?.id || lobbyChannel.parentId;
      const panelChannelId = panelChannel?.id || null;
      db.setJtcConfig(guild.id, lobbyChannel.id, categoryId, panelChannelId);

      if (panelChannel) {
        const sharedPanel = buildSharedPanel(guild.id);
        await panelChannel.send(sharedPanel).catch(() => null);
      }

      return message.reply({
        embeds: [embed.success('JTC System Activated 🚀', [
          `**Lobby Channel:** ${lobbyChannel}`,
          `**Category:** ${categoryId ? `<#${categoryId}>` : 'Same as lobby'}`,
          `**Panel Channel:** ${panelChannelId ? `<#${panelChannelId}>` : 'VC Text Chat (default)'}`,
          '',
          'When someone joins the lobby, a private voice channel and control panel will be created automatically.',
          'To disable: `/jtcdisable`'
        ].join('\n'))]
      });
    },
    async executeSlash(interaction) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ embeds: [embed.warn('Unauthorized', 'You need Manage Server permissions to use this.')], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;

      let lobbyChannel = interaction.options.getChannel('channel');
      const lobbyIdStr = interaction.options.getString('channel_id');
      if (!lobbyChannel && lobbyIdStr) lobbyChannel = await guild.channels.fetch(lobbyIdStr.trim().replace(/\D/g, '')).catch(()=>null);
      
      if (!lobbyChannel && lobbyIdStr) {
         return interaction.editReply({ embeds: [embed.warn('Invalid ID', 'Could not find the specified lobby channel.')] });
      }

      let category = interaction.options.getChannel('category');
      const categoryIdStr = interaction.options.getString('category_id');
      if (!category && categoryIdStr) category = await guild.channels.fetch(categoryIdStr.trim().replace(/\D/g, '')).catch(()=>null);

      let panelChannel = interaction.options.getChannel('panel_channel');
      const panelIdStr = interaction.options.getString('panel_id');
      if (!panelChannel && panelIdStr) panelChannel = await guild.channels.fetch(panelIdStr.trim().replace(/\D/g, '')).catch(()=>null);

      if (!lobbyChannel) {
        const cat = await guild.channels.create({ name: '➕ Voice Rooms', type: ChannelType.GuildCategory, reason: 'Athena Prime JTC Setup' });
        lobbyChannel = await guild.channels.create({ name: '➕ Join to Create', type: ChannelType.GuildVoice, parent: cat.id, reason: 'Athena Prime JTC Setup' });
        category = cat;
      }

      const categoryId = category?.id || lobbyChannel.parentId;
      const panelChannelId = panelChannel?.id || null;
      db.setJtcConfig(guild.id, lobbyChannel.id, categoryId, panelChannelId);

      if (panelChannel) {
        const sharedPanel = buildSharedPanel(guild.id);
        await panelChannel.send(sharedPanel).catch(() => null);
      }

      await interaction.editReply({
        embeds: [embed.success('JTC System Activated 🚀', [
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
  // ─── SECONDARY JTC SETUP ───
  {
    name: 'secondaryjtc',
    description: 'Set up a secondary Join to Create lobby. (Admin only)',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [
      { name: 'channel', description: 'Select VC lobby (or use channel_id)', type: 7, required: false, channel_types: [2] },
      { name: 'channel_id', description: 'Or paste VC lobby ID here', type: 3, required: false }
    ],
    async executePrefix(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isBotOwnerSync(message.author.id)) return;
      const guild = message.guild;

      let lobbyChannel = null;

      for (const arg of args) {
        const id = arg.replace(/\D/g, '');
        if (!id) continue;
        const channel = await guild.channels.fetch(id).catch(() => null);
        if (channel && channel.isVoiceBased()) {
          lobbyChannel = channel;
          break;
        }
      }

      if (!lobbyChannel && args.length > 0) {
         return message.reply({ embeds: [embed.warn('Invalid ID', 'The provided ID did not resolve to a valid voice channel in this server.')] });
      }

      if (!lobbyChannel) {
        const jtcConfig = db.getJtcConfig(guild.id);
        const parentId = jtcConfig?.categoryId || null;
        lobbyChannel = await guild.channels.create({ name: '➕ Secondary JTC', type: ChannelType.GuildVoice, parent: parentId, reason: 'Athena Prime Secondary JTC Setup' });
      }

      db.setSecondaryJtcConfig(guild.id, lobbyChannel.id);

      return message.reply({
        embeds: [embed.success('Secondary JTC System Activated 🚀', [
          `**Secondary Lobby:** ${lobbyChannel}`,
          '',
          'When someone joins this lobby, a voice channel will be created automatically, just like the primary lobby.'
        ].join('\n'))]
      });
    },
    async executeSlash(interaction) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ embeds: [embed.warn('Unauthorized', 'You need Manage Server permissions to use this.')], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;

      let lobbyChannel = interaction.options.getChannel('channel');
      const lobbyIdStr = interaction.options.getString('channel_id');
      if (!lobbyChannel && lobbyIdStr) lobbyChannel = await guild.channels.fetch(lobbyIdStr.trim().replace(/\D/g, '')).catch(()=>null);
      
      if (!lobbyChannel && lobbyIdStr) {
         return interaction.editReply({ embeds: [embed.warn('Invalid ID', 'Could not find the specified lobby channel.')] });
      }

      if (!lobbyChannel) {
        const jtcConfig = db.getJtcConfig(guild.id);
        const parentId = jtcConfig?.categoryId || null;
        lobbyChannel = await guild.channels.create({ name: '➕ Secondary JTC', type: ChannelType.GuildVoice, parent: parentId, reason: 'Athena Prime Secondary JTC Setup' });
      }

      db.setSecondaryJtcConfig(guild.id, lobbyChannel.id);

      await interaction.editReply({
        embeds: [embed.success('Secondary JTC System Activated 🚀', [
          `**Secondary Lobby:** ${lobbyChannel}`,
          '',
          'When someone joins this lobby, a voice channel will be created automatically, just like the primary lobby.'
        ].join('\n'))]
      });
    }
  },

  // ─── JTCDISABLE ───
  {
    name: 'jtcdisable',
    description: ' Disable the Join to Create system. (Admin only)',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [],
    async executePrefix(message) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isBotOwnerSync(message.author.id)) return;
      db.clearJtcConfig(message.guild.id);
      return message.reply({ embeds: [embed.danger('JTC Disabled', 'The Join to Create system has been turned off.')] });
    },
    async executeSlash(interaction) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ embeds: [embed.warn('Unauthorized', 'You need Manage Server permissions to use this.')], ephemeral: true });
      }
      db.clearJtcConfig(interaction.guild.id);
      return interaction.reply({ embeds: [embed.danger('JTC Disabled', 'The Join to Create system has been turned off.')], ephemeral: true });
    }
  },

  // ─── VC SLASH COMMANDS ───
  {
    name: 'vc',
    description: '� Voice channel quick actions. Use the panel buttons for all settings.',
    category: 'utility',
    permissions: [],
    options: [
      { name: 'claim', description: 'Claim ownership of the channel if the owner left', type: 1 },
      { name: 'info', description: 'Show your voice channel details', type: 1 }
    ],
    async executePrefix(message) {
      return message.reply({ embeds: [embed.info('Use the Panel', 'Use the control panel buttons in your channel to manage your VC settings.')] });
    },
    async executeSlash(interaction) {
      const sub = interaction.options.getSubcommand();
      const member = interaction.member;
      const guild = interaction.guild;
      const vcChannel = member.voice?.channel;

      if (!vcChannel) return interaction.reply({ embeds: [embed.warn('Not In Voice', 'You must be in a voice channel to use this.')], ephemeral: true });
      const jtcData = db.getJtcChannel(vcChannel.id);
      if (!jtcData) return interaction.reply({ embeds: [embed.warn('Not A JTC Channel', 'This only works in a Join to Create channel.')], ephemeral: true });

      if (sub === 'claim') {
        if (vcChannel.members.has(jtcData.ownerId)) return interaction.reply({ embeds: [embed.warn('Cannot Claim', 'The owner is still in the channel.')], ephemeral: true });
        db.setJtcOwner(vcChannel.id, member.id);
        await vcChannel.permissionOverwrites.edit(member.id, { Connect: true, ManageChannels: true }).catch(() => null);
        return interaction.reply({ embeds: [embed.success('Claimed ', `You are now the owner of **${vcChannel.name}**.`)] });
      }

      if (sub === 'info') {
        const owner = await guild.members.fetch(jtcData.ownerId).catch(() => null);
        return interaction.reply({ embeds: [embed.info('Channel Info', null, [
          { name: '� Name', value: vcChannel.name, inline: true },
          { name: ' Owner', value: owner?.toString() || `\`${jtcData.ownerId}\``, inline: true },
          { name: '� Limit', value: vcChannel.userLimit === 0 ? 'Unlimited' : `${vcChannel.userLimit}`, inline: true },
          { name: '� Bitrate', value: `${vcChannel.bitrate / 1000}kbps`, inline: true },
          { name: '� Region', value: vcChannel.rtcRegion || 'Auto', inline: true },
          { name: ' NSFW', value: vcChannel.nsfw ? 'Yes' : 'No', inline: true }
        ])], ephemeral: true });
      }
    }
  },
  {
    name: 'jtc',
    description: 'Join to Create management commands.',
    category: 'utility',
    permissions: [],
    options: [
      {
        name: 'add',
        description: 'Permit a user to join your locked JTC channel.',
        type: 1,
        options: [
          {
            name: 'user',
            description: 'The user to permit',
            type: 6, // USER type
            required: true
          }
        ]
      }
    ],
    async executePrefix(message) {
      return message.reply({ embeds: [embed.info('Use Slash Command', 'Please use `/jtc add @user` to permit a user.')] });
    },
    async executeSlash(interaction) {
      const sub = interaction.options.getSubcommand();
      const member = interaction.member;
      const vcChannel = member.voice?.channel;

      if (!vcChannel) return interaction.reply({ embeds: [embed.warn('Not In Voice', 'You must be in a voice channel to use this.')], ephemeral: true });
      const jtcData = db.getJtcChannel(vcChannel.id);
      if (!jtcData) return interaction.reply({ embeds: [embed.warn('Not A JTC Channel', 'This only works in a Join to Create channel.')], ephemeral: true });

      // Only the channel owner or an admin can permit someone
      if (jtcData.ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ embeds: [embed.warn('Unauthorized', 'Only the channel owner can permit users.')], ephemeral: true });
      }

      if (sub === 'add') {
        const targetUser = interaction.options.getUser('user');
        await vcChannel.permissionOverwrites.edit(targetUser.id, { Connect: true, ViewChannel: true });
        return interaction.reply({ embeds: [embed.success('User Permitted ', `<@${targetUser.id}> can now join your channel even when locked or ghosted.`)] });
      }
    }
  }
];
