import { EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

// Safely load config
const configPath = path.resolve('config.json');
let config = {
  colors: {
    success: '#00ffaa',
    warning: '#ffaa00',
    danger: '#ff3333',
    neutral: '#3b82f6',
    raid: '#8b5cf6',
    dark: '#2f3136'
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

/**
 * Embed utility to construct state-of-the-art beautiful coloured replies
 */
export const embed = {
  /**
   * General builder to standardize layout, footers and timestamps
   */
  build({ title, description, color, fields = [], thumbnail, footerText, author }) {
    const builder = new EmbedBuilder()
      .setColor(color || colors.dark)
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
      text: footerText || 'Medusa Unbypassable Security',
      iconURL: 'https://img.icons8.com/color/48/shield.png' // Nice visual touch
    });

    if (author) {
      builder.setAuthor({
        name: author.name,
        iconURL: author.iconURL
      });
    }

    return builder;
  },

  success(title, description, fields = []) {
    return this.build({
      title: `✅ ${title}`,
      description,
      color: colors.success,
      fields
    });
  },

  warn(title, description, fields = []) {
    return this.build({
      title: `⚠️ ${title}`,
      description,
      color: colors.warning,
      fields
    });
  },

  danger(title, description, fields = []) {
    return this.build({
      title: `🚨 ${title}`,
      description,
      color: colors.danger,
      fields
    });
  },

  info(title, description, fields = []) {
    return this.build({
      title: `ℹ️ ${title}`,
      description,
      color: colors.neutral,
      fields
    });
  },

  raid(title, description, fields = []) {
    return this.build({
      title: `🔒 ${title}`,
      description,
      color: colors.raid,
      fields
    });
  },

  log(title, description, fields = [], level = 'info') {
    let color = colors.dark;
    let icon = '📝';
    if (level === 'success') { color = colors.success; icon = '🟩'; }
    else if (level === 'warning') { color = colors.warning; icon = '🟨'; }
    else if (level === 'danger') { color = colors.danger; icon = '🟥'; }
    else if (level === 'raid') { color = colors.raid; icon = '🟪'; }

    return this.build({
      title: `${icon} Log: ${title}`,
      description,
      color,
      fields
    });
  }
};
export default embed;
