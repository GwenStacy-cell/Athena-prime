import { cacheDeletedItem } from '../utils/antinuke.js';
import db from '../database.js';
import embed from '../embed.js';
import { logServerEvent } from '../utils/serverLogger.js';

export default {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel.guild) return;
    if (db.isModModeActive(channel.guild.id)) return;

    // Cache the channel so the audit log event can perfectly restore it
    cacheDeletedItem(channel.id, channel);

    // Fetch audit log to find who deleted it
    await new Promise(r => setTimeout(r, 500));
    const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: 12 /* ChannelDelete */ }).catch(() => null);
    const entry = logs?.entries?.first();
    let executor = 'Unknown';
    if (entry && entry.target?.id === channel.id) {
      executor = entry.executor ? `${entry.executor.tag} (<@${entry.executor.id}>)` : executor;
    }

    const delEmbed = embed.build({
      description: `__**Channel Deleted |**__ <:emoji_16:1521464002046328944>\n> **Channel Name:** ${channel.name}\n>  **Type:** ${channel.type}\n>  **Executor:** ${executor}`,
      color: '#2b2d31'
    });
    await logServerEvent(channel.guild, 'channels', delEmbed);
  }
};
