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

    const isCategory = channel.type === 4 || channel.type === 4;

    directStrike(
      channel.guild,
      AuditLogEvent.ChannelDelete,
      isCategory ? 'Category Deletion' : 'Channel Deletion',
      channel.id,
      async () => {
        try {
          const cachedCh = deletedCache.get(channel.id);
          if (!cachedCh) return;
          if (queuedRestorations.has(channel.id)) return;
          queuedRestorations.add(channel.id);
          
          const isCat = cachedCh.type === 4;
          const parentId = restoredCategories.get(cachedCh.parentId) || cachedCh.parentId;
          const overwrites = cachedCh.permissionOverwrites?.cache
            ? cachedCh.permissionOverwrites.cache.map(o => ({
                id: o.id,
                type: o.type,
                allow: o.allow?.bitfield ?? 0n,
                deny: o.deny?.bitfield ?? 0n
              }))
            : [];

          const createOptions = {
            name: cachedCh.name,
            type: cachedCh.type,
            position: cachedCh.rawPosition ?? cachedCh.position ?? 0,
            permissionOverwrites: overwrites,
            reason: 'Athena Anti-Nuke: Restored deleted channel'
          };

          // Only non-categories can have a parent
          if (!isCat && parentId) {
            createOptions.parent = parentId;
          }

          // Text (0), Announcement (5), Forum (15) support topic, nsfw, slowmode
          if ([0, 5, 15].includes(cachedCh.type)) {
            if (cachedCh.topic) createOptions.topic = cachedCh.topic;
            if (typeof cachedCh.nsfw === 'boolean') createOptions.nsfw = cachedCh.nsfw;
            if (typeof cachedCh.rateLimitPerUser === 'number') createOptions.rateLimitPerUser = cachedCh.rateLimitPerUser;
          }

          // Voice (2) and Stage (13) support bitrate, userLimit, rtcRegion
          if ([2, 13].includes(cachedCh.type)) {
            if (cachedCh.bitrate) createOptions.bitrate = cachedCh.bitrate;
            if (cachedCh.userLimit) createOptions.userLimit = cachedCh.userLimit;
            if (cachedCh.rtcRegion) createOptions.rtcRegion = cachedCh.rtcRegion;
          }

          const newCh = await channel.guild.channels.create(createOptions);

          // Guarantee position restoration
          if (cachedCh.rawPosition !== undefined) {
            await newCh.setPosition(cachedCh.rawPosition, { reason: 'Athena Anti-Nuke: Fixing channel position' }).catch(() => {});
          }

          if (isCat) {
            restoredCategories.set(channel.id, newCh.id);
          }
        } catch (e) {
          try {
            await channel.guild.channels.create({
              name: channel.name,
              type: channel.type,
              reason: 'Athena Anti-Nuke: Restored fallback channel'
            });
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
      description: `__**Channel Deleted |**__ <a:uptime:1552608831060844575>\n> **Channel Name:** ${channel.name}\n>  **Type:** ${channel.type}\n>  **Executor:** ${executor}`,
      color: '#2b2d31'
    });
    await logServerEvent(channel.guild, 'channels', delEmbed);
  }
};
