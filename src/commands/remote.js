import { isBotOwnerSync } from '../utils/helpers.js';
import cv2 from '../cv2.js';

export const commands = [
  {
    name: 'remote',
    description: 'Remotely execute ANY command on a specific server from DMs.',
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) return;

      const guildId = args[0];
      if (!guildId) {
        return message.reply(cv2.warn('Usage', '`!remote <serverId> <command> [args...]`\n\nExample: `!remote 123456789012345678 ban @user`'));
      }

      const targetGuild = message.client.guilds.cache.get(guildId);
      if (!targetGuild) {
        return message.reply(cv2.danger('Error', 'Bot is not in that server or invalid ID.'));
      }

      const cmdName = args[1]?.toLowerCase();
      if (!cmdName) {
        return message.reply(cv2.warn('Missing Command', 'Provide a command to execute remotely.'));
      }

      // We dynamically import commandMap to avoid circular dependency issues at load time
      const { commandMap } = await import('./loader.js');
      const cmd = commandMap.get(cmdName.replace(/^!/, '')); // strip prefix if they typed !command
      
      if (!cmd) {
        return message.reply(cv2.danger('Not Found', `Command \`${cmdName}\` does not exist.`));
      }

      // Attempt to fetch the owner in the target guild (for commands that check member permissions)
      // If the owner isn't in the server, fallback to the bot's own member object
      let targetMember = await targetGuild.members.fetch(message.author.id).catch(() => targetGuild.members.me);

      const mockMessage = new Proxy(message, {
        get(target, prop) {
          if (prop === 'guild') return targetGuild;
          if (prop === 'guildId') return targetGuild.id;
          if (prop === 'member') return targetMember;
          // Let message.channel and message.reply remain untouched so outputs go to the DM!
          return Reflect.get(target, prop);
        }
      });

      const cmdArgs = args.slice(2);
      
      await message.reply(cv2.log('Remote Execution', `Executing \`${cmd.name}\` in **${targetGuild.name}**...`));

      try {
        if (cmd.executePrefix) {
          await cmd.executePrefix(mockMessage, cmdArgs);
        } else if (cmd.executeSlash) {
          const { createMockInteraction } = await import('../utils/mockInteraction.js');
          const mockInt = createMockInteraction(mockMessage, cmdArgs, cmd);
          await cmd.executeSlash(mockInt);
        }
      } catch (err) {
        message.reply(cv2.danger('Remote Execution Failed', `\`${err.message}\``));
      }
    }
  }
];
