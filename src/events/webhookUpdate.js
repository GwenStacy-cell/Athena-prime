import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';
import db from '../database.js';

export default {
  name: 'webhookUpdate',
  async execute(channel) {
    if (!channel.guild) return;
    if (db.isModModeActive(channel.guild.id)) return;

    // We fetch recent audit logs to determine if it was a create or delete
    try {
      await new Promise(r => setTimeout(r, 500)); // wait for audit log propagation
      
      const createLogs = await channel.guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.WebhookCreate }).catch(() => null);
      const deleteLogs = await channel.guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.WebhookDelete }).catch(() => null);
      
      const createEntry = createLogs?.entries?.first();
      const deleteEntry = deleteLogs?.entries?.first();

      const now = Date.now();
      let triggered = false;

      // Check for Webhook Creation
      if (createEntry && now - createEntry.createdTimestamp < 5000) {
        triggered = true;
        await checkAntiNuke(channel.guild, 'Webhook Creation', AuditLogEvent.WebhookCreate, createEntry.target.id, createEntry.target);
      }
      
      // Check for Webhook Deletion
      if (deleteEntry && now - deleteEntry.createdTimestamp < 5000) {
        triggered = true;
        await checkAntiNuke(channel.guild, 'Webhook Deletion', AuditLogEvent.WebhookDelete, deleteEntry.target.id, deleteEntry.target);
      }

      // Note: checkAntiNuke will handle duplicate triggers within 10 seconds via its rate tracking or ignoring duplicates.
    } catch (e) {
      // Ignore
    }
  }
};
