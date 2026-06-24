export default {
  name: 'roleCreate',
  async execute(role) {
    if (!role.guild) return;
    // handled by guildAuditLogEntryCreate
  }
};
