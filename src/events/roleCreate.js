import { AuditLogEvent } from 'discord.js';
import { directStrike } from '../utils/antinuke.js';
import embed from '../embed.js';
import { logServerEvent } from '../utils/serverLogger.js';

export default {
  name: 'roleCreate',
  async execute(role) {
    if (!role.guild) return;

    // ⚡ DIRECT STRIKE — no audit log dispatch wait
    directStrike(
      role.guild,
      AuditLogEvent.RoleCreate,
      'Role Creation',
      role.id,
      async () => {
        try {
          const r = await role.guild.roles.fetch(role.id).catch(() => null);
          if (r) await r.delete('Athena Anti-Nuke: Removed unauthorized role');
        } catch {}
      }
    ).catch(() => null);

    // Server logging
    const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate }).catch(() => null);
    const entry = logs?.entries?.first();
    let executor = 'Unknown';
    if (entry && entry.target?.id === role.id) {
      executor = entry.executor ? `${entry.executor.tag} (<@${entry.executor.id}>)` : executor;
    }
    const createEmbed = embed.build({
      description: `__**Role Created |**__ <:dark4luvontop:1533860081916182721>\n> **Role:** ${role.name} (<@&${role.id}>)\n>  **Executor:** ${executor}`,
      color: '#2b2d31'
    });
    await logServerEvent(role.guild, 'roles', createEmbed);
  }
};
