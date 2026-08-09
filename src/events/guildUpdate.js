// GuildUpdate (server name, vanity, verification, content filter tampering)
// is now handled with zero-latency via the websocket hook in guildAuditLogEntryCreate.js
export default {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    // No-op: handleAuditLogEntry handles this instantly via AuditLogEvent.GuildUpdate
  }
};
