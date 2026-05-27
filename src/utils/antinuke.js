import { AuditLogEvent } from 'discord.js';
import db from '../database.js';
import { executeQuarantine } from '../commands/security.js';
import embed from '../embed.js';
import { logToSecurityChannel } from './helpers.js';

/**
 * Centrally validates server mutations and quarantines unauthorized executors immediately
 */
export async function checkAntiNuke(guild, eventType, auditLogEvent, targetId = null) {
  // Ensure guild exists
  if (!guild) return;

  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;

  try {
    // Fetch latest entry for this audit log event
    const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: auditLogEvent }).catch(() => null);
    if (!auditLogs) return;

    const entry = auditLogs.entries.first();
    if (!entry) return;

    const { executor, target, createdAt } = entry;

    // Prevent loop / self-punishment
    if (executor.id === guild.members.me.id) return;
    if (executor.bot) return;

    // Ensure audit log is fresh (within last 8 seconds to prevent capturing old logs)
    if (Date.now() - createdAt.getTime() > 8000) return;

    // Strict target validation for member removals to ensure we capture the actual kicked user
    if (targetId && target && target.id !== targetId) return;


    // Check if executor is owner or whitelisted
    if (db.isWhitelisted(guild, executor.id)) {
      return; // Fully immune!
    }

    // Unauthorized Admin detected! Execute quarantine isolation.
    const reason = `[CRITICAL ANTI-NUKE] Unauthorized server modification detected (Type: ${eventType})`;
    
    const executorMember = await guild.members.fetch(executor.id).catch(() => null);
    if (!executorMember) return;

    // Trigger severe quarantine isolation
    const quarantineRes = await executeQuarantine(guild, executorMember, guild.members.me, reason);

    // High priority security log
    const nukeEmbed = embed.log(
      'Anti-Nuke Containment Triggered',
      `🚨 An unauthorized administrator attempted to mutate server components and was isolated.`,
      [
        { name: 'Administrator', value: `${executor.tag} (ID: ${executor.id})`, inline: true },
        { name: 'Forbidden Action', value: `\`${eventType}\``, inline: true },
        { name: 'Targeted Component ID', value: `\`${target?.id || 'Unknown'}\``, inline: true },
        { name: 'Status', value: quarantineRes.success ? '🟢 Containment Active (Roles Stripped)' : '🔴 Containment Failed (Check Bot Role Hierarchy)' }
      ],
      'raid'
    );
    await logToSecurityChannel(guild, nukeEmbed);

  } catch (error) {
    console.error(`[ANTI-NUKE ENGINE ERROR] failed to analyze audit logs for ${eventType}:`, error);
  }
}
