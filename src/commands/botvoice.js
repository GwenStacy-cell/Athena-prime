import { PermissionFlagsBits } from 'discord.js';
import { isBotOwnerSync } from '../utils/helpers.js';
import cv2 from '../cv2.js';

const voiceStateMemory = new Map();

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

      if (!['mute', 'unmute', 'deafen', 'undeafen', 'music', 'idle', 'active', 'save', 'restore'].includes(action)) {
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
          `**Memory System (Global Remote):**\n` +
          `> • \`save\` - Memorizes current mute/deaf states across ALL servers\n` +
          `> • \`restore\` - Reverts all servers back to their saved states\n\n` +
          `**Scope:**\n` +
          `> Add \`all\` at the end of standard commands to apply globally (e.g. \`!botvoice active all\`).`
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

      if (action === 'save') {
        let savedCount = 0;
        for (const guild of message.client.guilds.cache.values()) {
          const me = guild.members.me;
          if (me?.voice?.channel) {
            voiceStateMemory.set(guild.id, {
              mute: me.voice.serverMute,
              deaf: me.voice.serverDeaf
            });
            savedCount++;
          }
        }
        return message.reply(cv2.success('Voice States Memorized', 
          `Successfully saved the exact mute/deaf status of the bot across **${savedCount}** active servers!\n\n` +
          `You can now safely use \`!botvoice active all\` to globally unmute everything. When you're done, use \`!botvoice restore\` to instantly revert every server back to its original state!`
        ));
      }

      if (action === 'restore') {
        if (voiceStateMemory.size === 0) {
          return message.reply(cv2.warn('No Memory Found', 'There are no saved voice states in memory. Use `!botvoice save` first.'));
        }
        
        const msg = await message.reply(cv2.log('Restoring States', 'Restoring original voice states globally...'));
        let restoredCount = 0;
        
        for (const [guildId, state] of voiceStateMemory.entries()) {
           const guild = message.client.guilds.cache.get(guildId);
           if (guild) {
             const success = await applyState(guild, state);
             if (success) restoredCount++;
           }
        }
        voiceStateMemory.clear();
        return msg.edit(cv2.success('Voice States Restored', `Successfully reverted the bot back to its original mute/deafen status across **${restoredCount}** servers!`));
      }

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
