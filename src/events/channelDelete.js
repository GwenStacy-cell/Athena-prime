import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';
import db from '../database.js';

export default {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel.guild) return;
    if (db.isModModeActive(channel.guild.id)) return;

    // antinuke.js handles BOTH punishment AND restoration — do NOT duplicate here
    await checkAntiNuke(channel.guild, 'Channel Deletion', AuditLogEvent.ChannelDelete, null, channel);
  }
};
