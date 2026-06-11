import { checkBanRemove } from '../utils/antinuke.js';

export default {
  name: 'guildBanRemove',
  async execute(ban) {
    const { guild, user } = ban;
    if (!guild) return;
    await checkBanRemove(guild, user);
  }
};
