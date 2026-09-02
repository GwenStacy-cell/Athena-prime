import { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ChannelType } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { convertMp4ToGif, uploadGifToDiscord } from '../utils/mediaConverter.js';
import { isBotOwnerSync } from '../utils/helpers.js';

// ============================================================
// PLACEHOLDER RESOLVER
// ============================================================
function resolve(text, member, cfg = {}) {
  if (!text) return '';
  const guild = member.guild;
    let userFormat = `<@${member.id}>`;
  if (cfg.nameFormat === 'user_link') {
    userFormat = `[${member.user.username}](https://discord.com/users/${member.id})`;
  } else if (cfg.nameFormat === 'nick_link') {
    userFormat = `[${member.displayName}](https://discord.com/users/${member.id})`;
  }
  return text
    .replace(/{user}/gi, userFormat)
    .replace(/{usermention}/gi, userFormat)
    .replace(/{username}/gi, member.user.username)
    .replace(/{displayname}/gi, member.displayName)
    .replace(/{server}/gi, guild.name)
    .replace(/{count}/gi, String(guild.memberCount))
    .replace(/{avatar}/gi, member.user.displayAvatarURL({ dynamic: true }))
    .replace(/{user\.avatar}/gi, member.user.displayAvatarURL({ dynamic: true }));
}

// ============================================================
// BUILD EMBED FROM CONFIG
// ============================================================
export function buildWelcomeEmbed(member, cfg) {
  if (!cfg) return null;
  const e = new EmbedBuilder();

  if (cfg.color) {
    try { e.setColor(cfg.color); } catch { e.setColor(0x5865F2); }
  } else {
    e.setColor(0x5865F2);
  }

  const userAvatar = member.user.displayAvatarURL({ dynamic: true, size: 256 });
  const avatarPos = cfg.avatarPos || 'thumbnail';

  if (cfg.from || avatarPos === 'author') {
    try {
      e.setAuthor({
        name: (cfg.from ? resolve(cfg.from, member, cfg) : resolve('{user}', member, cfg)).replace(/<@!?\d+>/g, member.user.username),
        iconURL: (avatarPos === 'author') ? userAvatar : (cfg.fromIcon ? resolve(cfg.fromIcon, member, cfg) : member.guild.iconURL({ dynamic: true }) || undefined)
      });
    } catch (err) {}
  }

  if (cfg.title) e.setTitle(resolve(cfg.title, member, cfg));

  if (cfg.description) e.setDescription(resolve(cfg.description, member, cfg));
  else if (!cfg.title && !cfg.from) e.setDescription(`**Welcome to ${member.guild.name}!**`);

  if (cfg.thumbnailUrl) {
    try { e.setThumbnail(resolve(cfg.thumbnailUrl, member, cfg)); } catch(e) {}
  } else if (avatarPos === 'thumbnail') {
    e.setThumbnail(userAvatar);
  }

  if (cfg.image) {
    try { e.setImage(resolve(cfg.image, member, cfg)); } catch(e) {}
  } else if (avatarPos === 'image') {
    e.setImage(userAvatar);
  }

  if (cfg.footer || avatarPos === 'footer') {
    try {
      e.setFooter({
        text: cfg.footer ? resolve(cfg.footer, member, cfg) : 'Welcome!',
        iconURL: (avatarPos === 'footer') ? userAvatar : undefined
      });
    } catch (err) {}
  }

  if (cfg.timestamp !== false) e.setTimestamp();

  return e;
}

// ============================================================
// SEND MESSAGE
// ============================================================
export async function sendWelcomeMessage(member) {
  const cfg = db.getWelcomeConfig(member.guild.id);
  if (!cfg?.enabled || !cfg?.channelId) return;
  const channel = member.guild.channels.cache.get(cfg.channelId);
  if (!channel) return;
  const content = cfg.message ? resolve(cfg.message, member, cfg) : undefined;
  const embedObj = buildWelcomeEmbed(member, cfg);
  const payload = {};
  if (content) payload.content = content;
  if (embedObj) payload.embeds = [embedObj];
  if (!payload.content && !payload.embeds) return;
  await channel.send(payload).catch(() => null);
}

export async function sendLeaveMessage(member) {
  const cfg = db.getLeaveConfig(member.guild.id);
  if (!cfg?.enabled || !cfg?.channelId) return;
  const channel = member.guild.channels.cache.get(cfg.channelId);
  if (!channel) return;
  const content = cfg.message ? resolve(cfg.message, member, cfg) : undefined;
  const embedObj = buildWelcomeEmbed(member, cfg);
  const payload = {};
  if (content) payload.content = content;
  if (embedObj) payload.embeds = [embedObj];
  if (!payload.content && !payload.embeds) return;
  await channel.send(payload).catch(() => null);
}

// ============================================================
// MANAGER UI
// ============================================================
function getManagerPanel(guildId, type) {
  const isWelcome = type === 'welcome';
  const cfg = (isWelcome ? db.getWelcomeConfig(guildId) : db.getLeaveConfig(guildId)) || {};
  const label = isWelcome ? 'Welcome' : 'Leave';
  const prefix = isWelcome ? 'welcmgr_' : 'leavmgr_';

  const replyData = cv2.info(
    `<:ticks:1533860039213842565> ${label} Manager`,
    `Manage the settings for your server's ${label.toLowerCase()} messages.\n\n` +
    `**Current Configuration:**\n` +
    `<:ticks:1533860039213842565> **Channel:** ${cfg.channelId ? `<#${cfg.channelId}>` : 'Not Set'}\n` +
    ` **Status:** ${cfg.enabled ? ' Enabled' : ' Disabled'}\n` +
    `<:ticks:1533860039213842565> **Top Text:** ${cfg.message ? `\`${cfg.message.slice(0, 40)}...\`` : 'Not Set'}\n` +
    `<:ticks:1533860039213842565> **Author (From):** ${cfg.from ? `\`${cfg.from.slice(0, 30)}...\`` : 'Not Set'}\n` +
    `<:ticks:1533860039213842565> **Title:** ${cfg.title ? `\`${cfg.title.slice(0, 30)}...\`` : 'Not Set'}\n` +
    `<:ticks:1533860039213842565> **Description:** ${cfg.description ? `\`${cfg.description.slice(0, 40)}...\`` : 'Not Set'}\n` +
    `<:ticks:1533860039213842565> **Color:** ${cfg.color ? `\`#${cfg.color.toString(16).toUpperCase()}\`` : 'Default'}\n` +
    `<:ticks:1533860039213842565> **Image:** ${cfg.image ? '[Link Set]' : 'Not Set'}\n` +
    `<:ticks:1533860039213842565> **Footer:** ${cfg.footer ? `\`${cfg.footer.slice(0, 30)}...\`` : 'Not Set'}\n` +
    ` <:ticks:1533860039213842565> **Name Format:** ${cfg.nameFormat === 'user_link' ? 'Username Link' : cfg.nameFormat === 'nick_link' ? 'Nickname Link' : 'Tag (@user)'}\n` +
      ` <:ticks:1533860039213842565> **Avatar Location:** ${cfg.avatarPos === 'author' ? 'Author (Top Left)' : cfg.avatarPos === 'footer' ? 'Footer (Bottom)' : cfg.avatarPos === 'image' ? 'Large Image (Bottom)' : cfg.avatarPos === 'off' ? 'Hidden' : 'Thumbnail (Top Right)'}\n` +
    ` **Timestamp:** ${cfg.timestamp !== false ? ' On' : ' Off'}`
  );

  const channelSelectRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`${prefix}channel`)
      .setPlaceholder('Select a channel to send messages...')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${prefix}text`).setLabel('Top Text').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}author`).setLabel('Author').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}title`).setLabel('Title').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}desc`).setLabel('Description').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${prefix}color`).setLabel('Color').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}image`).setLabel('Image').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}footer`).setLabel('Footer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}cycle_avatar`).setLabel('Avatar Location').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}toggle_time`).setLabel('Toggle Time').setStyle(ButtonStyle.Success)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${prefix}status`).setLabel(cfg.enabled ? 'Disable System' : 'Enable System').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${prefix}cycle_name`).setLabel('Name Format').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}test`).setLabel('Test Message').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${prefix}reset`).setLabel('Reset All').setStyle(ButtonStyle.Danger)
  );

  replyData.components.push(channelSelectRow, row1, row2, row3);
  return replyData;
}

// ============================================================
// INTERACTION HANDLERS
// ============================================================
export async function handleWelcomeManagerMenu(interaction) {
  const isServerOwner = interaction.guild.ownerId === interaction.user.id;
  const isBotOwner = isBotOwnerSync(interaction.user.id);
  const isExtraOwner = db.isExtraOwner(interaction.guild.id, interaction.user.id);

  if (!isServerOwner && !isBotOwner && !isExtraOwner) {
    return interaction.reply({ content: 'You do not have permission to manage this system.', flags: 64 });
  }
  const guildId = interaction.guild.id;
  const isWelcome = interaction.customId.startsWith('welcmgr_');
  const getConfig = isWelcome ? db.getWelcomeConfig.bind(db) : db.getLeaveConfig.bind(db);
  const setConfig = isWelcome ? db.setWelcomeConfig.bind(db) : db.setLeaveConfig.bind(db);
  const typeStr = isWelcome ? 'welcome' : 'leave';

  const cfg = getConfig(guildId) || {};
  const selectedChannel = interaction.values[0];

  setConfig(guildId, { ...cfg, channelId: selectedChannel });
  
  await interaction.update(getManagerPanel(guildId, typeStr));
}

export async function handleWelcomeManagerButton(interaction) {
  const guildId = interaction.guild.id;
  const customId = interaction.customId;
  const isWelcome = customId.startsWith('welcmgr_');
  const action = isWelcome ? customId.replace('welcmgr_', '') : customId.replace('leavmgr_', '');

  const isServerOwner = interaction.guild.ownerId === interaction.user.id;
  const isBotOwner = isBotOwnerSync(interaction.user.id);
  const isExtraOwner = db.isExtraOwner(interaction.guild.id, interaction.user.id);

  if (action !== 'test' && !isServerOwner && !isBotOwner && !isExtraOwner) {
    return interaction.reply({ content: 'You do not have permission to manage this system.', flags: 64 });
  }

  const getConfig = isWelcome ? db.getWelcomeConfig.bind(db) : db.getLeaveConfig.bind(db);
  const setConfig = isWelcome ? db.setWelcomeConfig.bind(db) : db.setLeaveConfig.bind(db);
  const typeStr = isWelcome ? 'welcome' : 'leave';

  const cfg = getConfig(guildId) || {};

  if (action === 'status') {
    setConfig(guildId, { ...cfg, enabled: !cfg.enabled });
    return interaction.update(getManagerPanel(guildId, typeStr));
  }
  
  if (action === 'channel') {
    const selectedChannel = interaction.values[0];
    setConfig(guildId, { ...cfg, channelId: selectedChannel });
    return interaction.update(getManagerPanel(guildId, typeStr));
  }
  
  if (action === 'cycle_avatar') {
    const sequence = ['thumbnail', 'author', 'footer', 'image', 'off'];
    const current = cfg.avatarPos || 'thumbnail';
    const next = sequence[(sequence.indexOf(current) + 1) % sequence.length];
    setConfig(guildId, { ...cfg, avatarPos: next });
    return interaction.update(getManagerPanel(guildId, typeStr));
  }
  
  if (action === 'cycle_name') {
    const sequence = ['tag', 'user_link', 'nick_link'];
    const current = cfg.nameFormat || 'tag';
    const next = sequence[(sequence.indexOf(current) + 1) % sequence.length];
    setConfig(guildId, { ...cfg, nameFormat: next });
    return interaction.update(getManagerPanel(guildId, typeStr));
  }

  if (action === 'toggle_time') {
    setConfig(guildId, { ...cfg, timestamp: !(cfg.timestamp !== false) });
    return interaction.update(getManagerPanel(guildId, typeStr));
  }

  if (action === 'reset') {
    setConfig(guildId, {});
    return interaction.update(getManagerPanel(guildId, typeStr));
  }

  if (action === 'test') {
    if (!cfg.channelId) return interaction.reply(cv2.warn('Channel Not Set', 'Please select a channel first.'));
    
    await interaction.deferReply();
    
    const content = cfg.message ? resolve(cfg.message, interaction.member, cfg) : undefined;
    const testEmbed = buildWelcomeEmbed(interaction.member, cfg);
    const payload = { embeds: [] };
    if (content) payload.content = `**[Preview]** ${content}`;
    if (testEmbed) payload.embeds = [testEmbed];
    
    await interaction.editReply(payload);
    return;
  }

  // Modals for everything else
  const prefix = isWelcome ? 'welc_' : 'leav_';

  if (action === 'text') {
    const modal = new ModalBuilder().setCustomId(`${prefix}modal_text`).setTitle('Set Top Text');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('val').setLabel('Message content (above embed)').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(cfg.message || '')
    ));
    return interaction.showModal(modal);
  }

  if (action === 'author') {
    const modal = new ModalBuilder().setCustomId(`${prefix}modal_author`).setTitle('Set Author (From)');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Author Text (e.g. "From Server")').setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.from || '')),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('icon').setLabel('Icon URL (leave empty for server icon)').setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.fromIcon || ''))
    );
    return interaction.showModal(modal);
  }

  if (action === 'title') {
    const modal = new ModalBuilder().setCustomId(`${prefix}modal_title`).setTitle('Set Embed Title');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('val').setLabel('Embed Title').setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.title || '')
    ));
    return interaction.showModal(modal);
  }

  if (action === 'desc') {
    const modal = new ModalBuilder().setCustomId(`${prefix}modal_desc`).setTitle('Set Embed Description');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('val').setLabel('Embed Body').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(cfg.description || '')
    ));
    return interaction.showModal(modal);
  }

  if (action === 'color') {
    const modal = new ModalBuilder().setCustomId(`${prefix}modal_color`).setTitle('Set Embed Color');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('val').setLabel('Hex Color Code (e.g. #5865F2)').setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.color ? `#${cfg.color.toString(16).toUpperCase()}` : '')
    ));
    return interaction.showModal(modal);
  }

  if (action === 'image') {
    const modal = new ModalBuilder().setCustomId(`${prefix}modal_image`).setTitle('Edit Media');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Large Image URL (Supports GIF & MP4)').setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.image || '')),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumb').setLabel('Thumbnail URL (Supports GIF & MP4)').setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.thumbnailUrl || ''))
    );
    return interaction.showModal(modal);
  }

  if (action === 'footer') {
    const modal = new ModalBuilder().setCustomId(`${prefix}modal_footer`).setTitle('Set Embed Footer');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Footer Text').setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.footer || '')),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('icon').setLabel('Footer Icon URL').setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.footerIcon || ''))
    );
    return interaction.showModal(modal);
  }
}

export async function handleWelcomeManagerModal(interaction) {
  const isServerOwner = interaction.guild.ownerId === interaction.user.id;
  const isBotOwner = isBotOwnerSync(interaction.user.id);
  const isExtraOwner = db.isExtraOwner(interaction.guild.id, interaction.user.id);

  if (!isServerOwner && !isBotOwner && !isExtraOwner) {
    return interaction.reply({ content: 'You do not have permission to manage this system.', flags: 64 });
  }

  const guildId = interaction.guild.id;
  const customId = interaction.customId;
  const isWelcome = customId.startsWith('welc_');
  const action = isWelcome ? customId.replace('welc_modal_', '') : customId.replace('leav_modal_', '');
  const getConfig = isWelcome ? db.getWelcomeConfig.bind(db) : db.getLeaveConfig.bind(db);
  const setConfig = isWelcome ? db.setWelcomeConfig.bind(db) : db.setLeaveConfig.bind(db);
  const typeStr = isWelcome ? 'welcome' : 'leave';

  const cfg = getConfig(guildId) || {};
  let val = interaction.fields.getTextInputValue('val')?.trim() || null;

  if (action === 'text') cfg.message = val;
  if (action === 'title') cfg.title = val;
  if (action === 'desc') cfg.description = val;
  
  if (action === 'author') {
    cfg.from = val;
    cfg.fromIcon = interaction.fields.getTextInputValue('icon')?.trim() || null;
  }
  
  if (action === 'footer') {
    cfg.footer = val;
    cfg.footerIcon = interaction.fields.getTextInputValue('icon')?.trim() || null;
  }

  if (action === 'color') {
    if (val) {
      const hex = val.replace('#', '');
      const int = parseInt(hex, 16);
      if (!isNaN(int)) cfg.color = int;
    } else {
      delete cfg.color;
    }
  }

  if (action === 'image') {
    if (!val || val.toLowerCase() === 'none') {
      delete cfg.image;
    } else {
      if (val.toLowerCase().endsWith('.mp4')) {
        await interaction.deferUpdate();
        try {
          const gifBuffer = await convertMp4ToGif(val);
          val = await uploadGifToDiscord(interaction, gifBuffer, 'large_image.gif');
        } catch (err) {
          console.error('Failed to convert large image MP4 to GIF:', err);
        }
      }
      cfg.image = val;
    }
    
    let thumbVal = interaction.fields.getTextInputValue('thumb')?.trim() || null;
    if (!thumbVal || thumbVal.toLowerCase() === 'none') {
      delete cfg.thumbnailUrl;
    } else {
      if (thumbVal.toLowerCase().endsWith('.mp4')) {
        if (!interaction.deferred) await interaction.deferUpdate();
        try {
          const gifBuffer = await convertMp4ToGif(thumbVal);
          thumbVal = await uploadGifToDiscord(interaction, gifBuffer, 'thumbnail.gif');
        } catch (err) {
          console.error('Failed to convert thumbnail MP4 to GIF:', err);
        }
      }
      cfg.thumbnailUrl = thumbVal;
    }
  }

  setConfig(guildId, cfg);
  
  if (interaction.deferred) {
    await interaction.editReply(getManagerPanel(guildId, typeStr));
  } else {
    await interaction.update(getManagerPanel(guildId, typeStr));
  }
}

// ============================================================
// COMMANDS
// ============================================================
export const commands = [
  {
    name: 'welcome',
    description: '<:ticks:1533860039213842565> Open the Welcome Message Manager.',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [], // No subcommands anymore!
    async executePrefix(message) {
      return message.reply(getManagerPanel(message.guild.id, 'welcome'));
    },
    async executeSlash(interaction) {
      return interaction.reply(getManagerPanel(interaction.guild.id, 'welcome'));
    }
  },
  {
    name: 'leave',
    description: '<:ticks:1533860039213842565> Open the Leave Message Manager.',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [],
    async executePrefix(message) {
      return message.reply(getManagerPanel(message.guild.id, 'leave'));
    },
    async executeSlash(interaction) {
      return interaction.reply(getManagerPanel(interaction.guild.id, 'leave'));
    }
  }
];
