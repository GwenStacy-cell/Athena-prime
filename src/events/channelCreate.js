import db from '../database.js';

export default {
  name: 'channelCreate',
  async execute(channel) {
    if (!channel.guild) return;
    
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
            }, { reason: 'Athena Prime — auto-hide new channel from quarantined users' });
          }
        }
      }
    } catch (err) {
      console.error('Failed to auto-hide new channel from quarantine role:', err);
    }
  }
};
