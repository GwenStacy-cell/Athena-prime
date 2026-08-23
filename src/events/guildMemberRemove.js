import { AuditLogEvent } from 'discord.js';
import { directStrike } from '../utils/antinuke.js';
import db from '../database.js';
import statsDB from '../statsDB.js';
import { sendLeaveMessage } from '../commands/welcome.js';
import { logServerEvent } from '../utils/serverLogger.js';
import embed from '../embed.js';

export default {
  name: 'guildMemberRemove',
  async execute(member) {
    const guild = member.guild;
    if (!guild) return;

    statsDB.logLeave(guild.id, member.id);

    // Send leave message and DM concurrently
    sendLeaveMessage(member).catch(() => null);
    try {
      const config = db.getGuildConfig(guild.id);
      const leaveDm = embed.build({
        title: `Goodbye from ${guild.name}!`,
        description: `We're sorry to see you go from **${guild.name}**. We will miss you! <:dark4luvontop:1533860081916182721>`,
        color: config.accentColor || '#2b2d31',
        thumbnail: guild.iconURL({ dynamic: true })
      });
      member.send({ embeds: [leaveDm] }).catch(() => null);
    } catch {}

    // ⚡ DIRECT STRIKE — detect kicks the instant the gateway fires
    // No 500ms wait. directStrike fetches the audit log immediately.
    directStrike(
      guild,
      AuditLogEvent.MemberKick,
      'Member Kick (Mass Kick Attack)',
      member.id,
      null // Kicks cannot be auto-reversed
    ).catch(() => null);

    // Server logging (with small delay only for logging accuracy)
    await new Promise(r => setTimeout(r, 300));
    const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick }).catch(() => null);
    const entry = logs?.entries?.first();

    let isKick = false;
    let executor = 'Unknown (Native/Other Bot)';
    let reason = 'No reason provided';

    if (entry && entry.target?.id === member.id && Date.now() - entry.createdAt.getTime() < 5000) {
      isKick = true;
      executor = entry.executor ? `${entry.executor.tag} (<@${entry.executor.id}>)` : executor;
      reason = entry.reason || reason;
    }

    if (isKick) {
      const kickEmbed = embed.build({
        description: `__**Member Kicked |**__ <:dark4luvontop:1533860081916182721>\n> **User:** ${member.user.tag} (<@${member.user.id}>)\n>  **Executor:** ${executor}\n>  **Reason:** ${reason}`,
        color: '#2b2d31',
        thumbnail: member.user.displayAvatarURL({ dynamic: true })
      });
      await logServerEvent(guild, 'kicks', kickEmbed);
    } else {
      const leaveEmbed = embed.build({
        description: `__**Member Left |**__ <:dark4luvontop:1533860081916182721>\n> **User:** ${member.user.tag} (<@${member.user.id}>)`,
        color: '#2b2d31',
        thumbnail: member.user.displayAvatarURL({ dynamic: true })
      });
      await logServerEvent(guild, 'leaves', leaveEmbed);
    }
  }
};
