import { checkGuildUpdate } from '../utils/antinuke.js';

export default {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    await checkGuildUpdate(oldGuild, newGuild);
  }
};
