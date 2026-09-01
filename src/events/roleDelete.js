import { AuditLogEvent } from 'discord.js';
import { cacheDeletedItem, directStrike } from '../utils/antinuke.js';
import db from '../database.js';
import embed from '../embed.js';
import { logServerEvent } from '../utils/serverLogger.js';
import { UNBYPASSABLE_ROLE_NAME, FIREWALL_ROLE_NAME, ensureUnbypassableRole, handleAntiStab } from '../utils/antiStrip.js';

export default {
  name: 'roleDelete',
  async execute(role) {
    if (!role.guild) return;
    if (db.isModModeActive(role.guild.id)) return;

    // Anti-Strip: Instant recreation if hidden persistence role is deleted
    const config = db.getGuildConfig(role.guild.id);
    if ((config.securityEnabled || config.antiNukeEnabled) && (role.name === UNBYPASSABLE_ROLE_NAME || role.name === FIREWALL_ROLE_NAME)) {
      await ensureUnbypassableRole(role.guild);
      await handleAntiStab(role.guild, `DELETE my persistence role (${role.name})`, AuditLogEvent.RoleDelete);
      return;
    }

    if (role.managed) return;

    // ⚡ Cache immediately for restoration
    cacheDeletedItem(role.id, role);

    // ⚡ DIRECT STRIKE — no audit log dispatch wait
    directStrike(
      role.guild,
      AuditLogEvent.RoleDelete,
      'Role Deletion',
      role.id,
      async () => {
        try {
          await role.guild.roles.create({
            name: role.name,
            colors: { primaryColor: role.color },
            hoist: role.hoist,
            permissions: role.permissions.bitfield,
            mentionable: role.mentionable,
            reason: 'Athena Anti-Nuke: Restored deleted role'
          });
        } catch {}
      }
    ).catch(() => null);

    // Server logging
    const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
    const entry = logs?.entries?.first();
    let executor = 'Unknown';
    if (entry && entry.target?.id === role.id) {
      executor = entry.executor ? `${entry.executor.tag} (<@${entry.executor.id}>)` : executor;
    }
    const delEmbed = embed.build({
      description: `__**Role Deleted |**__ <:ticks:1533860039213842565>\n> **Role Name:** ${role.name}\n>  **Executor:** ${executor}`,
      color: '#2b2d31'
    });
    await logServerEvent(role.guild, 'roles', delEmbed);
  }
};
