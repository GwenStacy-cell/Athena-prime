import { handleAuditLogEntry, recordAuditEntry } from '../utils/antinuke.js';

export default {
  name: 'guildAuditLogEntryCreate',
  async execute(auditLogEntry, guild) {
    if (!guild) return;
    
    // ⚡ Ingest into 0ms WebSocket ring buffer
    recordAuditEntry(guild.id, auditLogEntry);

    // Pass the raw entry directly to the antinuke handler
    await handleAuditLogEntry(guild, auditLogEntry);
  }
};
