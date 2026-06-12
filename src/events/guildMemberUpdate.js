import { checkAntiNukeMemberUpdate } from '../utils/antinuke.js';
import { UNBYPASSABLE_ROLE_NAME, alertOwner } from '../utils/antiStrip.js';

export default {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    // Anti-Strip: Instant restore if the bot is stripped of its persistence role
    if (newMember.id === newMember.client.user.id) {
      const oldHas = oldMember.roles.cache.some(r => r.name === UNBYPASSABLE_ROLE_NAME);
      const newHas = newMember.roles.cache.some(r => r.name === UNBYPASSABLE_ROLE_NAME);
      if (oldHas && !newHas) {
        const unbypassableRole = newMember.guild.roles.cache.find(r => r.name === UNBYPASSABLE_ROLE_NAME);
        if (unbypassableRole) {
          await newMember.roles.add(unbypassableRole).catch(() => null);
          await alertOwner(newMember.guild, 'strip my hidden persistence role from me');
        }
      }
    }

    await checkAntiNukeMemberUpdate(oldMember, newMember);
  }
};
