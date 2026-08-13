import db from '../database.js';

export default {
  name: 'guildDelete',
  async execute(guild) {
    if (!guild || !guild.client) return;

    try {
      if (!db.cache.botAnalytics) db.cache.botAnalytics = { joins: 0, leaves: 0, cmds: {} };
      db.cache.botAnalytics.leaves++;
      db.save();
    } catch (e) {
      console.error('Error in guildDelete event:', e);
    }
  }
};
