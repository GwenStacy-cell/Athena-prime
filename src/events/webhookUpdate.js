export default {
  name: 'webhookUpdate',
  async execute(channel) {
    if (!channel.guild) return;
    // handled by guildAuditLogEntryCreate
  }
};
