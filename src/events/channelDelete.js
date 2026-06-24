import { cacheDeletedItem } from '../utils/antinuke.js';
import db from '../database.js';

export default {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel.guild) return;
    if (db.isModModeActive(channel.guild.id)) return;

    // Cache the channel so the audit log event can perfectly restore it
    cacheDeletedItem(channel.id, channel);
  }
};
