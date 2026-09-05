export default {
  name: 'webhooksUpdate',
  async execute(channel) {
    if (!channel.guild) return;
    // handled by guildAuditLogEntryCreate
  }
};
