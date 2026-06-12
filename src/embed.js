import { EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import db from './database.js';

// Safely load config
const configPath = path.resolve('config.json');
let config = {
  botName: 'Athena Prime',
  footerText: 'Athena Prime Security',
  colors: {
    success: '#00ffaa',
    warning: '#ffaa00',
    danger: '#ff3333',
    neutral: '#3b82f6',
    raid: '#8b5cf6',
    dark: '#2f3136',
    owner: '#FFD700',
    security: '#00e5ff'
  }
};
try {
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (error) {
  console.error('Failed to load config in embed helper, using defaults:', error);
}

const colors = config.colors;
const FOOTER_TEXT = config.footerText || 'Athena Prime Security';

/**
 * Get the active accent color for a guild. Falls back to the type's default color.
 * @param {string|null} guildId
 * @param {string} fallbackColor
 */
function getAccentColor(guildId, fallbackColor) {
  if (!guildId) return fallbackColor;
  try {
    const cfg = db.getGuildConfig(guildId);
    if (cfg && cfg.accentColor) return cfg.accentColor;
  } catch { /* ignore */ }
  return fallbackColor;
}

/**
 * Embed utility to construct state-of-the-art beautiful coloured replies
 */
export const embed = {
  /**
   * General builder to standardize layout, footers and timestamps
   */
  build({ title, description, color, fields = [], thumbnail, footerText, author, guildId = null }) {
    // If guildId is provided, the accent color overrides the default for all non-alert embeds
    const finalColor = color || colors.dark;

    const builder = new EmbedBuilder()
      .setColor(finalColor)
      .setTimestamp();

    if (title) builder.setTitle(title);
    if (description) builder.setDescription(description);
    if (thumbnail) builder.setThumbnail(thumbnail);

    if (fields && fields.length > 0) {
      builder.addFields(fields.map(f => ({
        name: f.name,
        value: f.value,
        inline: !!f.inline
      })));
    }

    builder.setFooter({
      text: footerText || FOOTER_TEXT,
      iconURL: 'https://img.icons8.com/color/48/shield.png'
    });

    if (author) {
      builder.setAuthor({
        name: author.name,
        iconURL: author.iconURL
      });
    }

    return builder;
  },

  success(title, description, fields = [], guildId = null) {
    const accent = getAccentColor(guildId, colors.success);
    return this.build({ title, description, color: accent, fields });
  },

  warn(title, description, fields = []) {
    // Warnings are always yellow — accent doesn't apply to alerts
    return this.build({ title, description, color: colors.warning, fields });
  },

  danger(title, description, fields = []) {
    // Danger is always red — accent doesn't apply to alerts
    return this.build({ title, description, color: colors.danger, fields });
  },

  info(title, description, fields = [], guildId = null) {
    const accent = getAccentColor(guildId, colors.neutral);
    return this.build({ title, description, color: accent, fields });
  },

  raid(title, description, fields = []) {
    return this.build({ title, description, color: colors.raid, fields });
  },

  /**
   * Gold/Amber embed for owner-related responses (e.g., "You tagged my Master!")
   */
  owner(title, description, fields = []) {
    return this.build({ title, description, color: colors.owner || '#FFD700', fields });
  },

  /**
   * Security status embed with cyan accent
   */
  security(title, description, fields = [], guildId = null) {
    const accent = getAccentColor(guildId, colors.security || '#00e5ff');
    return this.build({ title, description, color: accent, fields });
  },

  log(title, description, fields = [], level = 'info') {
    let color = colors.dark;
    if (level === 'success') { color = colors.success; }
    else if (level === 'warning') { color = colors.warning; }
    else if (level === 'danger') { color = colors.danger; }
    else if (level === 'raid') { color = colors.raid; }

    return this.build({
      title: `Log: ${title}`,
      description,
      color,
      fields
    });
  }
};
export default embed;
