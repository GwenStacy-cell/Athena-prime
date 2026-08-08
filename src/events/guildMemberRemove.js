import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';
import { sendLeaveMessage } from '../commands/welcome.js';
import { logServerEvent } from '../utils/serverLogger.js';
import embed from '../embed.js';

export default {
  name: 'guildMemberRemove',
  async execute(member) {
    const guild = member.guild;
    if (!guild) return;

    // Run Audit Log check for kicks (Anti-Nuke)
    await checkAntiNuke(guild, 'Member Kick', AuditLogEvent.MemberKick, member.id);

    // Send leave message
    await sendLeaveMessage(member);

    // Determine if kicked or left voluntarily
    await new Promise(r => setTimeout(r, 500));
    const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick }).catch(() => null);
    const entry = logs?.entries?.first();

    let isKick = false;
    let executor = 'Unknown (Native/Other Bot)';
    let reason = 'No reason provided';
    
    // Check if the kick entry was created within the last 5 seconds for this specific user
    if (entry && entry.target?.id === member.id && Date.now() - entry.createdAt.getTime() < 5000) {
      isKick = true;
      executor = entry.executor ? `${entry.executor.tag} (<@${entry.executor.id}>)` : executor;
      reason = entry.reason || reason;
    }

    if (isKick) {
      const kickEmbed = embed.build({
        description: `__**Member Kicked |**__ <:emoji_16:1533860111704002665>\n> **User:** ${member.user.tag} (<@${member.user.id}>)\n>  **Executor:** ${executor}\n>  **Reason:** ${reason}`,
        color: '#2b2d31',
        thumbnail: member.user.displayAvatarURL({ dynamic: true })
      });
      await logServerEvent(guild, 'kicks', kickEmbed);
    } else {
      const leaveEmbed = embed.build({
        description: `__**Member Left |**__ <:emoji_16:1533860111704002665>\n> **User:** ${member.user.tag} (<@${member.user.id}>)`,
        color: '#2b2d31',
        thumbnail: member.user.displayAvatarURL({ dynamic: true })
      });
      await logServerEvent(guild, 'leaves', leaveEmbed);
    }
  }
};
