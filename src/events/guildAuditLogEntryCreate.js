import { handleAuditLogEntry } from '../utils/antinuke.js';

export default {
  name: 'guildAuditLogEntryCreate',
  async execute(auditLogEntry, guild) {
    if (!guild) return;
    
    // Pass the raw entry directly to the new antinuke handler
    await handleAuditLogEntry(guild, auditLogEntry);
  }
};
