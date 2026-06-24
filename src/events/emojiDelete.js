import { cacheDeletedItem } from '../utils/antinuke.js';
import db from '../database.js';

export default {
  name: 'emojiDelete',
  async execute(emoji) {
    if (!emoji.guild) return;

    if (db.isModModeActive(emoji.guild.id)) return;

    cacheDeletedItem(emoji.id, emoji);
  }
};
