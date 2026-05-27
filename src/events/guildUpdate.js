import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';

export default {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
      // Restore previous vanity URL and punish the executor
      await checkAntiNuke(newGuild, 'Vanity URL Modification', AuditLogEvent.GuildUpdate, null, oldGuild.vanityURLCode);
    }
  }
};
