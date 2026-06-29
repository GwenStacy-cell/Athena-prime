import { CronJob } from 'cron';
import db from '../database.js';

export function startMusicCleanupJob(client) {
  // Run every 5 minutes
  const job = new CronJob('*/5 * * * *', async () => {
    try {
      const guilds = Object.keys(db.cache.guilds || {});
      for (const guildId of guilds) {
        const cfg = db.getGuildConfig(guildId);
        if (!cfg.musicChannelId || !cfg.musicMessageId) continue;

        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(cfg.musicChannelId);
        if (!channel) continue;

        try {
          // Fetch up to 100 recent messages
          const messages = await channel.messages.fetch({ limit: 100 });
          
          // Filter out the music player message
          const toDelete = messages.filter(msg => msg.id !== cfg.musicMessageId);
          
          if (toDelete.size > 0) {
            // Bulk delete messages under 14 days old
            const bulkDeletable = toDelete.filter(m => (Date.now() - m.createdTimestamp) < 1209600000);
            const manualDeletable = toDelete.filter(m => (Date.now() - m.createdTimestamp) >= 1209600000);
            
            if (bulkDeletable.size > 0) {
              await channel.bulkDelete(bulkDeletable, true).catch(() => null);
            }
            
            // Fallback for older messages
            for (const [id, msg] of manualDeletable) {
              await msg.delete().catch(() => null);
            }
          }
        } catch (err) {
          // Ignore API errors for missing permissions, etc.
        }
      }
    } catch (error) {
      console.error('[MusicCleanupJob] Error:', error);
    }
  });

  job.start();
}
