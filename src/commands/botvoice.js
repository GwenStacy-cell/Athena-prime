import { PermissionFlagsBits } from 'discord.js';
import { isBotOwnerSync } from '../utils/helpers.js';
import cv2 from '../cv2.js';

export const commands = [
  {
    name: 'botvoice',
    aliases: ['bv', 'botmute', 'botdeafen'],
    description: 'Control the bot\'s Server Mute and Server Deafen status across voice channels.',
    async executePrefix(message, args) {
      const isOwner = isBotOwnerSync(message.author.id);
      if (message.guild && !message.member.permissions.has(PermissionFlagsBits.Administrator) && !isOwner) {
        return message.reply(cv2.danger('Access Denied', 'You need Administrator permissions to use this.'));
      }

      const action = args[0]?.toLowerCase();
      const scope = args[1]?.toLowerCase() === 'all' ? 'all' : 'this';

      if (!['mute', 'unmute', 'deafen', 'undeafen', 'music', 'idle', 'active'].includes(action)) {
        return message.reply(cv2.info('Bot Voice Control', 
          `**Usage:** \`!botvoice <action> [all]\`\n\n` +
          `**Actions:**\n` +
          `> • \`mute\` - Server Mutes the bot\n` +
          `> • \`unmute\` - Server Unmutes the bot\n` +
          `> • \`deafen\` - Server Deafens the bot\n` +
          `> • \`undeafen\` - Server Undeafens the bot\n` +
          `> • \`music\` - Unmuted & Deafened (Standard)\n` +
          `> • \`idle\` - Muted & Deafened (Quiet Mode)\n` +
          `> • \`active\` - Unmuted & Undeafened (Recording Mode)\n\n` +
          `**Scope:**\n` +
          `> Add \`all\` at the end to apply to EVERY server where the bot is currently in a VC.`
        ));
      }

      const applyState = async (guild, stateChanges) => {
        try {
          const me = guild.members.me;
          if (!me?.voice?.channel) return false;
          await me.edit(stateChanges);
          return true;
        } catch (e) {
          return false;
        }
      };

      const getChanges = (act) => {
        switch (act) {
          case 'mute': return { mute: true };
          case 'unmute': return { mute: false };
          case 'deafen': return { deaf: true };
          case 'undeafen': return { deaf: false };
          case 'music': return { mute: false, deaf: true };
          case 'idle': return { mute: true, deaf: true };
          case 'active': return { mute: false, deaf: false };
        }
      };

      const changes = getChanges(action);
      let successCount = 0;

      if (scope === 'this') {
        const success = await applyState(message.guild, changes);
        if (success) {
          return message.reply(cv2.success('Voice State Updated', `Successfully applied \`${action}\` to the bot in this server.`));
        } else {
          return message.reply(cv2.warn('Voice Update Failed', 'The bot is not in a voice channel in this server, or lacks permissions.'));
        }
      } else {
        const msg = await message.reply(cv2.log('Processing', `Applying \`${action}\` to all active voice sessions...`));
        for (const guild of message.client.guilds.cache.values()) {
          const success = await applyState(guild, changes);
          if (success) successCount++;
        }
        return msg.edit(cv2.success('Global Voice Update', `Successfully applied \`${action}\` to the bot in **${successCount}** servers.`));
      }
    }
  }
];
