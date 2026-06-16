import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';
import db from '../database.js';

export default {
  name: 'emojiDelete',
  async execute(emoji) {
    if (!emoji.guild) return;

    if (db.isModModeActive(emoji.guild.id)) return;

    await checkAntiNuke(emoji.guild, 'Emoji Deletion', AuditLogEvent.EmojiDelete, emoji.id, emoji);
  }
};
