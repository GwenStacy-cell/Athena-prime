import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} from 'discord.js';
import db from '../database.js';
import { isBotOwnerSync } from '../utils/helpers.js';

// ——————————————————————————————————————————
// PRESET ACCENT COLORS — Curated palette
// ——————————————————————————————————————————
const PRESETS = [
  { label: 'Neon Green',    hex: '#00FF9F', emoji: '🟢' },
  { label: 'Electric Blue', hex: '#3B82F6', emoji: '🔵' },
  { label: 'Crimson Red',   hex: '#FF3355', emoji: '🔴' },
  { label: 'Royal Purple',  hex: '#8B5CF6', emoji: '🟣' },
  { label: 'Cyber Gold',    hex: '#FFD700', emoji: '🟡' },
  { label: 'Frost White',   hex: '#E0F2FE', emoji: '⬜' },
  { label: 'Midnight',      hex: '#1E1B4B', emoji: '⬛' },
  { label: 'Sunset Orange', hex: '#FF6B35', emoji: '🟠' },
  { label: 'Hot Pink',      hex: '#FF0090', emoji: '🩷' },
  { label: 'Aqua Cyan',     hex: '#00E5FF', emoji: '🩵' },
];

function hexToInt(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

// ——————————————————————————————————————————
// BUILD THE ACCENT PANEL EMBED + COMPONENTS
// ——————————————————————————————————————————
export function buildAccentPanel(guild) {
  const cfg = db.getGuildConfig(guild.id);
  const current = cfg.accentColor || null;

  const embed = new EmbedBuilder()
    .setColor(current ? hexToInt(current) : 0x2b2d31)
    .setTitle('🎨  Accent Color Manager')
    .setDescription(
      `Customize the accent color used across all of **Athena Prime's** responses in this server.\n\nAll \`256³\` colors are available — choose a preset below, enter a custom hex code, or reset to the default.\n\n` +
      `**CURRENT COLOR:** ${current ? `\`${current}\`` : 'Default (no accent set)'}`
    )
    .setFooter({ text: 'Athena Prime Customization • Changes apply instantly' })
    .setTimestamp();

  // Row 1: Presets 1-5
  const row1 = new ActionRowBuilder().addComponents(
    ...PRESETS.slice(0, 5).map(p =>
      new ButtonBuilder()
        .setCustomId(`accent_preset_${p.hex.replace('#', '')}`)
        .setLabel(p.label)
        .setEmoji(p.emoji)
        .setStyle(current?.toUpperCase() === p.hex.toUpperCase() ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  );

  // Row 2: Presets 6-10
  const row2 = new ActionRowBuilder().addComponents(
    ...PRESETS.slice(5, 10).map(p =>
      new ButtonBuilder()
        .setCustomId(`accent_preset_${p.hex.replace('#', '')}`)
        .setLabel(p.label)
        .setEmoji(p.emoji)
        .setStyle(current?.toUpperCase() === p.hex.toUpperCase() ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  );

  // Row 3: Custom Hex + Reset + Close
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('accent_custom_hex')
      .setLabel('Custom Hex')
      .setEmoji('🎨')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('accent_reset')
      .setLabel('Reset to Default')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('accent_close')
      .setLabel('Close')
      .setEmoji('✖️')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, components: [row1, row2, row3] };
}

// ——————————————————————————————————————————
// BUTTON HANDLER
// ——————————————————————————————————————————
export async function handleAccentButton(interaction) {
  const { customId, guild, user } = interaction;

  // Auth check — server owner, bot owner, or extra owner
  const isAuth = isBotOwnerSync(user.id) ||
    user.id === guild.ownerId ||
    db.isExtraOwner(guild.id, user.id) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

  if (!isAuth) {
    return interaction.reply({
      content: '🛡️ Only the **Server Owner** or **Administrators** can change the accent color.',
      ephemeral: true
    });
  }

  // ——— Custom Hex — Show Modal ———
  if (customId === 'accent_custom_hex') {
    const modal = new ModalBuilder()
      .setCustomId('accent_hex_modal')
      .setTitle('Custom Accent Color');

    const hexInput = new TextInputBuilder()
      .setCustomId('accent_hex_input')
      .setLabel('HEX COLOR CODE')
      .setPlaceholder('#FFFFFF or FFFFFF')
      .setStyle(TextInputStyle.Short)
      .setMinLength(6)
      .setMaxLength(7)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(hexInput));
    return interaction.showModal(modal);
  }

  // ——— Preset Color ———
  if (customId.startsWith('accent_preset_')) {
    const hex = '#' + customId.replace('accent_preset_', '');
    db.updateGuildConfig(guild.id, { accentColor: hex.toUpperCase() });
    const panel = buildAccentPanel(guild);
    return interaction.update({ embeds: [panel.embed], components: panel.components });
  }

  // ——— Reset ———
  if (customId === 'accent_reset') {
    db.updateGuildConfig(guild.id, { accentColor: null });
    const panel = buildAccentPanel(guild);
    return interaction.update({ embeds: [panel.embed], components: panel.components });
  }

  // ——— Close ———
  if (customId === 'accent_close') {
    return interaction.update({
      content: '✅ Accent color manager closed.',
      embeds: [],
      components: []
    });
  }
}

// ——————————————————————————————————————————
// MODAL HANDLER
// ——————————————————————————————————————————
export async function handleAccentModal(interaction) {
  const rawHex = interaction.fields.getTextInputValue('accent_hex_input').trim();
  const clean = rawHex.startsWith('#') ? rawHex : `#${rawHex}`;
  const valid = /^#[0-9A-Fa-f]{6}$/.test(clean);

  if (!valid) {
    return interaction.reply({
      content: `❌ **Invalid hex code:** \`${rawHex}\`\n\nPlease enter a valid 6-digit hex color code (e.g. \`#FF3355\` or \`FF3355\`).`,
      ephemeral: true
    });
  }

  db.updateGuildConfig(interaction.guild.id, { accentColor: clean.toUpperCase() });

  const panel = buildAccentPanel(interaction.guild);
  return interaction.update({ embeds: [panel.embed], components: panel.components });
}

// ——————————————————————————————————————————
// COMMAND DEFINITION
// ——————————————————————————————————————————
export const commands = [
  {
    name: 'accent',
    description: "Customize Athena Prime's accent color for this server's embeds.",
    category: 'utility',
    permissions: [PermissionFlagsBits.Administrator],
    options: [],
    async executePrefix(message) {
      const isAuth = isBotOwnerSync(message.author.id) ||
        message.author.id === message.guild.ownerId ||
        db.isExtraOwner(message.guild.id, message.author.id) ||
        message.member?.permissions?.has(PermissionFlagsBits.Administrator);

      if (!isAuth) {
        const { embed } = await import('../embed.js');
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} Only Administrators can manage the accent color.`)] });
      }

      const panel = buildAccentPanel(message.guild);
      await message.reply({ embeds: [panel.embed], components: panel.components });
    },
    async executeSlash(interaction) {
      const panel = buildAccentPanel(interaction.guild);
      await interaction.reply({ embeds: [panel.embed], components: panel.components });
    }
  }
];

export default commands;
