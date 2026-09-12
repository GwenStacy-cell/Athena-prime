import { AuditLogEvent } from 'discord.js';
import { cacheDeletedItem, directStrike, deletedCache, queuedRestorations, restoredCategories } from '../utils/antinuke.js';
import db from '../database.js';
import embed from '../embed.js';
import { logServerEvent } from '../utils/serverLogger.js';

export default {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel.guild) return;
    if (db.isModModeActive(channel.guild.id)) return;

    cacheDeletedItem(channel.id, channel);

    directStrike(
      channel.guild,
      AuditLogEvent.ChannelDelete,
      'Channel Deletion',
      channel.id,
      async () => {
        try {
          const cachedCh = deletedCache.get(channel.id);
          if (!cachedCh) return;
          if (queuedRestorations.has(channel.id)) return;
          queuedRestorations.add(channel.id);
          const isCategory = cachedCh.type === 4;
          const parentId = restoredCategories.get(cachedCh.parentId) || cachedCh.parentId;
          const overwrites = cachedCh.permissionOverwrites.cache.map(o => ({
            id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield
          }));
          const newCh = await channel.guild.channels.create({
            name: cachedCh.name, type: cachedCh.type, topic: cachedCh.topic || null,
            parent: parentId || null, position: cachedCh.rawPosition,
            permissionOverwrites: overwrites,
            reason: 'Athena Anti-Nuke: Restored deleted channel'
          });
          // Explicitly set position again to guarantee it doesn't change relative position
          await newCh.setPosition(cachedCh.rawPosition, { reason: 'Athena Anti-Nuke: Fixing channel position' }).catch(()=>{});
          if (isCategory) restoredCategories.set(channel.id, newCh.id);
        } catch (e) {
          try {
            await channel.guild.channels.create({ name: channel.name, type: channel.type, reason: 'Athena Anti-Nuke: Restored without parent' });
          } catch {}
        }
      }
    ).catch(() => null);

    const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
    const entry = logs?.entries?.first();
    let executor = 'Unknown';
    if (entry && entry.target?.id === channel.id) {
      executor = entry.executor ? `${entry.executor.tag} (<@${entry.executor.id}>)` : executor;
    }
    const delEmbed = embed.build({
      description: `__**Channel Deleted |**__ <:ticks:1533860039213842565>\n> **Channel Name:** ${channel.name}\n>  **Type:** ${channel.type}\n>  **Executor:** ${executor}`,
      color: '#2b2d31'
    });
    await logServerEvent(channel.guild, 'channels', delEmbed);
  }
};
