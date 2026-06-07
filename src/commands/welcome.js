import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

// ============================================================
// PLACEHOLDER RESOLVER
// ============================================================
function resolve(text, member) {
  if (!text) return '';
  const guild = member.guild;
  return text
    .replace(/{user}/gi, `<@${member.id}>`)
    .replace(/{username}/gi, member.user.username)
    .replace(/{displayname}/gi, member.displayName)
    .replace(/{server}/gi, guild.name)
    .replace(/{count}/gi, String(guild.memberCount))
    .replace(/{avatar}/gi, member.user.displayAvatarURL({ dynamic: true }));
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

  if (cfg.from) {
    e.setAuthor({
      name: resolve(cfg.from, member),
      iconURL: cfg.fromIcon || member.guild.iconURL({ dynamic: true }) || undefined
    });
  }

  if (cfg.title) e.setTitle(resolve(cfg.title, member));

  if (cfg.description) e.setDescription(resolve(cfg.description, member));
  else if (!cfg.title && !cfg.from) e.setDescription(`**Welcome to ${member.guild.name}!**`);

  if (cfg.thumbnail !== false) {
    e.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
  }

  if (cfg.image) e.setImage(cfg.image);

  if (cfg.footer) {
    e.setFooter({
      text: resolve(cfg.footer, member),
      iconURL: cfg.footerIcon || undefined
    });
  }

  if (cfg.timestamp !== false) e.setTimestamp();

  return e;
}

// ============================================================
// SEND WELCOME/LEAVE MESSAGE
// ============================================================
export async function sendWelcomeMessage(member) {
  const cfg = db.getWelcomeConfig(member.guild.id);
  if (!cfg?.enabled || !cfg?.channelId) return;

  const channel = member.guild.channels.cache.get(cfg.channelId);
  if (!channel) return;

  const content = cfg.message ? resolve(cfg.message, member) : undefined;
  const embedObj = buildWelcomeEmbed(member, cfg);

  const payload = {};
  if (content) payload.content = content;
  if (embedObj) payload.embeds = [embedObj];
  if (!payload.content && !payload.embeds) return;

  await channel.send(payload).catch(e => console.error('[Welcome] Send failed:', e.message));
}

export async function sendLeaveMessage(member) {
  const cfg = db.getLeaveConfig(member.guild.id);
  if (!cfg?.enabled || !cfg?.channelId) return;

  const channel = member.guild.channels.cache.get(cfg.channelId);
  if (!channel) return;

  const content = cfg.message ? resolve(cfg.message, member) : undefined;
  const embedObj = buildWelcomeEmbed(member, cfg);

  const payload = {};
  if (content) payload.content = content;
  if (embedObj) payload.embeds = [embedObj];
  if (!payload.content && !payload.embeds) return;

  await channel.send(payload).catch(e => console.error('[Leave] Send failed:', e.message));
}

// ============================================================
// SHARED SUBCOMMAND HANDLER
// ============================================================
async function handleConfig(interaction, type) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const isWelcome = type === 'welcome';
  const getConfig = isWelcome ? db.getWelcomeConfig.bind(db) : db.getLeaveConfig.bind(db);
  const setConfig = isWelcome ? db.setWelcomeConfig.bind(db) : db.setLeaveConfig.bind(db);

  const cfg = getConfig(guildId) || {};
  const label = isWelcome ? '👋 Welcome' : '👋 Leave';

  if (sub === 'setup') {
    const channel = interaction.options.getChannel('channel');
    setConfig(guildId, { ...cfg, channelId: channel.id, enabled: true });
    return interaction.reply({ embeds: [embed.success(`${label} Setup`, `Messages will be sent to ${channel}.\n\nUse the other subcommands to customize the embed.`)], ephemeral: true });
  }

  if (sub === 'disable') {
    setConfig(guildId, { ...cfg, enabled: false });
    return interaction.reply({ embeds: [embed.danger(`${label} Disabled`, `${type} messages have been turned off.`)], ephemeral: true });
  }

  if (sub === 'message') {
    const text = interaction.options.getString('text');
    setConfig(guildId, { ...cfg, message: text });
    return interaction.reply({ embeds: [embed.success('Message Set', `Content above embed set to:\n\`\`\`${text}\`\`\`\n**Placeholders:** \`{user}\` \`{username}\` \`{displayname}\` \`{server}\` \`{count}\``)], ephemeral: true });
  }

  if (sub === 'color') {
    const hex = interaction.options.getString('hex').replace('#', '');
    const int = parseInt(hex, 16);
    if (isNaN(int)) return interaction.reply({ embeds: [embed.warn('Invalid Color', 'Provide a valid hex color e.g. `#5865F2`')], ephemeral: true });
    setConfig(guildId, { ...cfg, color: int });
    return interaction.reply({ embeds: [embed.success('Color Set', `Embed color set to \`#${hex.toUpperCase()}\`.`)], ephemeral: true });
  }

  if (sub === 'from') {
    const text = interaction.options.getString('text');
    const icon = interaction.options.getString('icon') || null;
    setConfig(guildId, { ...cfg, from: text, fromIcon: icon });
    return interaction.reply({ embeds: [embed.success('"From" Author Set', `Author field set to **${text}**.\n${icon ? `Icon: ${icon}` : 'Icon: Server icon (default)'}`)], ephemeral: true });
  }

  if (sub === 'title') {
    const text = interaction.options.getString('text');
    setConfig(guildId, { ...cfg, title: text });
    return interaction.reply({ embeds: [embed.success('Title Set', `Embed title set to **${text}**.`)], ephemeral: true });
  }

  if (sub === 'description') {
    const text = interaction.options.getString('text');
    setConfig(guildId, { ...cfg, description: text });
    return interaction.reply({ embeds: [embed.success('Description Set', `Embed description updated.`)], ephemeral: true });
  }

  if (sub === 'thumbnail') {
    const enabled = interaction.options.getBoolean('enabled');
    setConfig(guildId, { ...cfg, thumbnail: enabled });
    return interaction.reply({ embeds: [embed.success('Thumbnail', `User avatar thumbnail is now **${enabled ? 'ON' : 'OFF'}**.`)], ephemeral: true });
  }

  if (sub === 'image') {
    const url = interaction.options.getString('url');
    setConfig(guildId, { ...cfg, image: url === 'none' ? null : url });
    return interaction.reply({ embeds: [embed.success('Image Set', url === 'none' ? 'Image removed.' : `Embed image set.`)], ephemeral: true });
  }

  if (sub === 'footer') {
    const text = interaction.options.getString('text');
    const icon = interaction.options.getString('icon') || null;
    setConfig(guildId, { ...cfg, footer: text, footerIcon: icon });
    return interaction.reply({ embeds: [embed.success('Footer Set', `Footer set to **${text}**.`)], ephemeral: true });
  }

  if (sub === 'timestamp') {
    const enabled = interaction.options.getBoolean('enabled');
    setConfig(guildId, { ...cfg, timestamp: enabled });
    return interaction.reply({ embeds: [embed.success('Timestamp', `Timestamp is now **${enabled ? 'ON' : 'OFF'}**.`)], ephemeral: true });
  }

  if (sub === 'test') {
    const freshCfg = getConfig(guildId);
    if (!freshCfg?.channelId) return interaction.reply({ embeds: [embed.warn('Not Set Up', `Run \`/${type} setup\` first.`)], ephemeral: true });
    const member = interaction.member;
    const content = freshCfg.message ? resolve(freshCfg.message, member) : undefined;
    const testEmbed = buildWelcomeEmbed(member, freshCfg);
    const payload = { embeds: [] };
    if (content) payload.content = `**[Preview]** ${content}`;
    if (testEmbed) payload.embeds = [testEmbed];
    await interaction.reply({ ...payload, ephemeral: true });
    return;
  }

  if (sub === 'view') {
    const freshCfg = getConfig(guildId) || {};
    return interaction.reply({
      embeds: [embed.info(`${label} Config`, null, [
        { name: '📡 Channel', value: freshCfg.channelId ? `<#${freshCfg.channelId}>` : 'Not set', inline: true },
        { name: '🔘 Enabled', value: freshCfg.enabled ? '✅ Yes' : '❌ No', inline: true },
        { name: '💬 Message', value: freshCfg.message ? `\`${freshCfg.message.slice(0, 80)}\`` : 'None', inline: false },
        { name: '👤 From (Author)', value: freshCfg.from || 'Not set', inline: true },
        { name: '🏷️ Title', value: freshCfg.title || 'Not set', inline: true },
        { name: '📝 Description', value: freshCfg.description ? `${freshCfg.description.slice(0, 60)}...` : 'Not set', inline: false },
        { name: '🖼️ Thumbnail', value: freshCfg.thumbnail !== false ? '✅ On' : '❌ Off', inline: true },
        { name: '🖼️ Image', value: freshCfg.image || 'None', inline: true },
        { name: '📄 Footer', value: freshCfg.footer || 'Not set', inline: true },
        { name: '⏰ Timestamp', value: freshCfg.timestamp !== false ? '✅ On' : '❌ Off', inline: true }
      ])],
      ephemeral: true
    });
  }

  if (sub === 'reset') {
    setConfig(guildId, {});
    return interaction.reply({ embeds: [embed.danger(`${label} Reset`, `All ${type} message settings have been cleared.`)], ephemeral: true });
  }
}

// ============================================================
// SHARED SUBCOMMAND OPTIONS
// ============================================================
function subcommandOptions(type) {
  return [
    { name: 'setup', description: `Set the ${type} channel`, type: 1, options: [
      { name: 'channel', description: `Channel to send ${type} messages`, type: 7, required: true, channel_types: [0] }
    ]},
    { name: 'message', description: 'Set the text above the embed', type: 1, options: [
      { name: 'text', description: 'Use {user} {username} {displayname} {server} {count}', type: 3, required: true, max_length: 500 }
    ]},
    { name: 'from', description: 'Set the "From" author field', type: 1, options: [
      { name: 'text', description: 'e.g. "From {server}" or "Welcome to the Family!"', type: 3, required: true },
      { name: 'icon', description: 'Author icon URL (default: server icon)', type: 3, required: false }
    ]},
    { name: 'title', description: 'Set the embed title (bold)', type: 1, options: [
      { name: 'text', description: 'Title text (supports placeholders)', type: 3, required: true }
    ]},
    { name: 'description', description: 'Set the embed description body', type: 1, options: [
      { name: 'text', description: 'Description text (supports placeholders)', type: 3, required: true, max_length: 2000 }
    ]},
    { name: 'color', description: 'Set the embed left-bar color', type: 1, options: [
      { name: 'hex', description: 'Hex color e.g. #5865F2', type: 3, required: true }
    ]},
    { name: 'thumbnail', description: 'Toggle user avatar as thumbnail (top-right)', type: 1, options: [
      { name: 'enabled', description: 'Show avatar as thumbnail?', type: 5, required: true }
    ]},
    { name: 'image', description: 'Set the large image at the bottom', type: 1, options: [
      { name: 'url', description: 'Direct image URL, or "none" to remove', type: 3, required: true }
    ]},
    { name: 'footer', description: 'Set the embed footer text', type: 1, options: [
      { name: 'text', description: 'Footer text', type: 3, required: true },
      { name: 'icon', description: 'Footer icon URL', type: 3, required: false }
    ]},
    { name: 'timestamp', description: 'Toggle timestamp in footer', type: 1, options: [
      { name: 'enabled', description: 'Show timestamp?', type: 5, required: true }
    ]},
    { name: 'test', description: `Preview the ${type} message as yourself`, type: 1 },
    { name: 'view', description: `View current ${type} config`, type: 1 },
    { name: 'disable', description: `Disable ${type} messages`, type: 1 },
    { name: 'reset', description: `Reset all ${type} settings`, type: 1 }
  ];
}

// ============================================================
// COMMANDS
// ============================================================
export const commands = [
  {
    name: 'welcome',
    description: '👋 Configure the welcome message system.',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: subcommandOptions('welcome'),
    async executePrefix(message) {
      return message.reply({ embeds: [embed.info('Use Slash Command', 'Please use `/welcome` to configure welcome messages.')] });
    },
    async executeSlash(interaction) {
      await handleConfig(interaction, 'welcome');
    }
  },
  {
    name: 'leave',
    description: '🚪 Configure the leave message system.',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: subcommandOptions('leave'),
    async executePrefix(message) {
      return message.reply({ embeds: [embed.info('Use Slash Command', 'Please use `/leave` to configure leave messages.')] });
    },
    async executeSlash(interaction) {
      await handleConfig(interaction, 'leave');
    }
  }
];
