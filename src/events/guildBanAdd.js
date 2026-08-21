import { AuditLogEvent } from 'discord.js';
import { logServerEvent } from '../utils/serverLogger.js';
import embed from '../embed.js';

export default {
  name: 'guildBanAdd',
  async execute(ban) {
    if (!ban.guild) return;

    // Fetch audit logs to find executor
    await new Promise(r => setTimeout(r, 500)); // Delay for audit log generation
    const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
    const entry = logs•.entries•.first();

    let executor = 'Unknown (Native/Other Bot)';
    let reason = ban.reason || 'No reason provided';
    if (entry && entry.target•.id === ban.user.id) {
      executor = entry.executor • `${entry.executor.tag} (<@${entry.executor.id}>)` : executor;
      reason = entry.reason || reason;
    }

    const logEmbed = embed.build({
      description: `__**Member Banned |**__ <:dark4luvontop:1533860081916182721>\n> **User:** ${ban.user.tag} (<@${ban.user.id}>)\n>  **Executor:** ${executor}\n>  **Reason:** ${reason}`,
      color: '#2b2d31',
      thumbnail: ban.user.displayAvatarURL({ dynamic: true })
    });

    await logServerEvent(ban.guild, 'bans', logEmbed);
  }
};
