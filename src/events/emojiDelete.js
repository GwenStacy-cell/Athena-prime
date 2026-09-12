import { AuditLogEvent } from 'discord.js';
import { cacheDeletedItem, directStrike, deletedCache, queuedRestorations } from '../utils/antinuke.js';
import db from '../database.js';

export default {
  name: 'emojiDelete',
  async execute(emoji) {
    if (!emoji.guild) return;
    if (db.isModModeActive(emoji.guild.id)) return;

    cacheDeletedItem(emoji.id, emoji);

    directStrike(
      emoji.guild,
      AuditLogEvent.EmojiDelete,
      'Emoji Deletion',
      emoji.id,
      async () => {
        try {
          const cached = deletedCache.get(emoji.id);
          if (!cached) return;
          if (queuedRestorations.has(emoji.id)) return;
          queuedRestorations.add(emoji.id);
          
          await emoji.guild.emojis.create({
            attachment: cached.url,
            name: cached.name,
            reason: 'Athena Anti-Nuke: Restored deleted emoji'
          });
        } catch {}
      }
    ).catch(() => null);
  }
};
