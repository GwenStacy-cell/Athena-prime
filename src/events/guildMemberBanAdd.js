import { AuditLogEvent } from 'discord.js';
import { checkMassBan } from '../utils/antinuke.js';

export default {
  name: 'guildMemberBanAdd',
  async execute(ban) {
    if (!ban.guild) return;
    await checkMassBan(ban.guild, ban.user);
  }
};
