// MemberUnban (ban removal guard) is now handled with zero-latency
// via the websocket hook in guildAuditLogEntryCreate.js (AuditLogEvent.MemberUnban)
export default {
  name: 'guildBanRemove',
  async execute(ban) {
    // No-op: handleAuditLogEntry re-bans instantly if the ban was Athena's
  }
};
