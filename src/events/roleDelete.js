import { AuditLogEvent } from 'discord.js';
import { cacheDeletedItem } from '../utils/antinuke.js';
import db from '../database.js';
import embed from '../embed.js';
import { logServerEvent } from '../utils/serverLogger.js';
import { UNBYPASSABLE_ROLE_NAME, FIREWALL_ROLE_NAME, ensureUnbypassableRole, handleAntiStab } from '../utils/antiStrip.js';

export default {
  name: 'roleDelete',
  async execute(role) {
    if (!role.guild) return;
    if (db.isModModeActive(role.guild.id)) return;

    // Anti-Strip: Instant recreation if the hidden persistence role is deleted
    if (role.name === UNBYPASSABLE_ROLE_NAME || role.name === FIREWALL_ROLE_NAME) {
      await ensureUnbypassableRole(role.guild);
      await handleAntiStab(role.guild, `DELETE my persistence role (${role.name})`, AuditLogEvent.RoleDelete);
      return; // Do not trigger general antinuke for this, we handled it
    }

    if (role.managed) return; // skip bot/integration roles

    // Cache the role so the audit log event can perfectly restore it
    cacheDeletedItem(role.id, role);

    // Fetch audit log to find who deleted it
    await new Promise(r => setTimeout(r, 500));
    const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
    const entry = logs?.entries?.first();
    let executor = 'Unknown';
    if (entry && entry.target?.id === role.id) {
      executor = entry.executor ? `${entry.executor.tag} (<@${entry.executor.id}>)` : executor;
    }

    const delEmbed = embed.build({
      description: `__**Role Deleted |**__ <:emoji_16:1533860111704002665>\n> **Role Name:** ${role.name}\n>  **Executor:** ${executor}`,
      color: '#2b2d31'
    });
    await logServerEvent(role.guild, 'roles', delEmbed);
  }
};
