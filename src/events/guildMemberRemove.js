import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';
import { sendLeaveMessage } from '../commands/welcome.js';

export default {
  name: 'guildMemberRemove',
  async execute(member) {
    const guild = member.guild;
    if (!guild) return;

    // Run Audit Log check for kicks.
    await checkAntiNuke(guild, 'Member Kick', AuditLogEvent.MemberKick, member.id);

    // Send leave message
    await sendLeaveMessage(member);
  }
};
