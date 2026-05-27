import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';

export default {
  name: 'guildMemberRemove',
  async execute(member) {
    const guild = member.guild;
    if (!guild) return;

    // Run Audit Log check for kicks.
    // If the latest audit entry matches AuditLogEvent.MemberKick and the target is this member,
    // the executor gets quarantined immediately.
    await checkAntiNuke(guild, 'Member Kick', AuditLogEvent.MemberKick, member.id);
  }
};
