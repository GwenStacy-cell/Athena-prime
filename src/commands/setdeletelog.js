import { PermissionFlagsBits } from 'discord.js';
import embed from '../embed.js';
import db from '../database.js';

export const commands = [
  {
    name: 'setdeletelog',
    description: 'Set a channel to log deleted messages.',
    category: 'utility',
    permissions: [PermissionFlagsBits.Administrator],
    async executePrefix(message, args) {
      try {
        const channel = message.mentions.channels.first();
        if (!channel) {
          return await message.reply({ embeds: [embed.warn('Error', 'Please mention a valid channel.')] }).catch(() => null);
        }

        const guild = message.guild;
        const config = db.getGuildConfig(guild.id);
        const sl = config.serverLogs;
        
        sl.modules.msgDeletes.channelId = channel.id;
        sl.modules.msgDeletes.enabled = true;
        sl.enabled = true; // Auto-enable master switch
        
        db.updateGuildConfig(guild.id, { serverLogs: sl });
        
        const res = { embeds: [embed.success('Delete Log Set', `Deleted messages will now be logged in <#${channel.id}>.`)] };
        await message.reply(res).catch(() => null);
      } catch (error) {
        console.error('Error in setdeletelog:', error);
      }
    }
  }
];
