import db from '../database.js';
import embed from '../embed.js';
import { logServerEvent } from '../utils/serverLogger.js';
export default {
  name: 'channelCreate',
  async execute(channel) {
    if (!channel.guild) return;

    // Fetch audit log to find creator
    await new Promise(r => setTimeout(r, 500));
    const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: 10 /* ChannelCreate */ }).catch(() => null);
    const entry = logs?.entries?.first();
    let executor = 'Unknown';
    if (entry && entry.target?.id === channel.id) {
      executor = entry.executor ? `${entry.executor.tag} (<@${entry.executor.id}>)` : executor;
    }

    const createEmbed = embed.build({
      description: `__**Channel Created |**__ <:dark4luvontop:1533860081916182721>\n> **Channel:** ${channel.name} (<#${channel.id}>)\n>  **Type:** ${channel.type}\n>  **Executor:** ${executor}`,
      color: '#2b2d31'
    });
    await logServerEvent(channel.guild, 'channels', createEmbed);
    
    // Auto-hide new channels from quarantined users
    try {
      const config = db.getGuildConfig(channel.guild.id);
      
      if (config.quarantineRoleId) {
        const qRole = await channel.guild.roles.fetch(config.quarantineRoleId).catch(() => null);
        if (qRole) {
          // Check if this channel is the quarantine channel itself
          const isQChannel = config.quarantineChannelId === channel.id || config.quarantineVcId === channel.id;
          
          if (!isQChannel) {
            await channel.permissionOverwrites.edit(qRole, {
              ViewChannel: false,
              SendMessages: false,
              Connect: false,
              Speak: false
            }, { reason: 'Athena Prime - auto-hide new channel from quarantined users' });
          }
        }
      }
    } catch (err) {
      console.error('Failed to auto-hide new channel from quarantine role:', err);
    }
  }
};
