import embed from '../embed.js';
import { logServerEvent } from '../utils/serverLogger.js';

export default {
  name: 'roleCreate',
  async execute(role) {
    if (!role.guild) return;

    // Fetch audit log to find creator
    await new Promise(r => setTimeout(r, 500));
    const logs = await role.guild.fetchAuditLogs({ limit: 1, type: 30 /* RoleCreate */ }).catch(() => null);
    const entry = logs?.entries?.first();
    let executor = 'Unknown';
    if (entry && entry.target?.id === role.id) {
      executor = entry.executor ? `${entry.executor.tag} (<@${entry.executor.id}>)` : executor;
    }

    const createEmbed = embed.success(
      'Role Created',
      `**Role:** ${role.name} (<@&${role.id}>)\n**Executor:** ${executor}`
    );
    await logServerEvent(role.guild, 'roles', createEmbed);
  }
};
