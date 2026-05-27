import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';

export default {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel.guild) return;
    await checkAntiNuke(channel.guild, 'Channel Deletion', AuditLogEvent.ChannelDelete);
  }
};
