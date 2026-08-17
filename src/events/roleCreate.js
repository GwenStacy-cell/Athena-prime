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

    const createEmbed = embed.build({
      description: `__**Role Created |**__ <:dark4luvontop:1533860081916182721>\n> **Role:** ${role.name} (<@&${role.id}>)\n>  **Executor:** ${executor}`,
      color: '#2b2d31'
    });
    await logServerEvent(role.guild, 'roles', createEmbed);
  }
};
