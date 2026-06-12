import { checkAntiNukeMemberUpdate } from '../utils/antinuke.js';
import { UNBYPASSABLE_ROLE_NAME, handleAntiStab } from '../utils/antiStrip.js';
import { AuditLogEvent } from 'discord.js';

export default {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    // Anti-Strip: Instant restore if the hidden persistence role is removed from the bot itself
    if (newMember.id === newMember.client.user.id) {
      const oldHas = oldMember.roles.cache.some(r => r.name === UNBYPASSABLE_ROLE_NAME);
      const newHas = newMember.roles.cache.some(r => r.name === UNBYPASSABLE_ROLE_NAME);
      
      if (oldHas && !newHas) {
        const roleToRestore = oldMember.guild.roles.cache.find(r => r.name === UNBYPASSABLE_ROLE_NAME);
        if (roleToRestore) {
          await newMember.roles.add(roleToRestore).catch(() => null);
          await handleAntiStab(newMember.guild, 'REMOVE my hidden persistence role from me', AuditLogEvent.MemberRoleUpdate);
        }
      }
    }

    await checkAntiNukeMemberUpdate(oldMember, newMember);
  }
};
