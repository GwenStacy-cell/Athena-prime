export default {
  name: 'channelCreate',
  async execute(channel) {
    if (!channel.guild) return;
    // handled by guildAuditLogEntryCreate
  }
};
