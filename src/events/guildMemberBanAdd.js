import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';

export default {
  name: 'guildMemberBanAdd',
  async execute(ban) {
    if (!ban.guild) return;
    await checkAntiNuke(ban.guild, 'Member Ban', AuditLogEvent.GuildBanAdd || AuditLogEvent.MemberBanAdd);
  }
};
