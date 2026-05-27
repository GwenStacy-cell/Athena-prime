import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';

export default {
  name: 'channelCreate',
  async execute(channel) {
    if (!channel.guild) return;
    await checkAntiNuke(channel.guild, 'Channel Creation', AuditLogEvent.ChannelCreate, channel.id);
  }
};
