import { checkAntiNukeMemberUpdate } from '../utils/antinuke.js';

export default {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    await checkAntiNukeMemberUpdate(oldMember, newMember);
  }
};
