import db from '../database.js';
import cv2 from '../cv2.js';
import commandMap from './loader.js';

export const commands = [
  {
    name: 'ccmd',
    aliases: ['customcmd', 'alias', 'short'],
    description: 'Create shortcuts for existing commands.',
    category: 'utilities',
    options: [],
    async executePrefix(message, args) {
      // Must be admin
      if (!message.member.permissions.has('Administrator') && !['1509084068619489331'].includes(message.author.id)) {
        return message.reply(cv2.danger('Access Denied', 'Only Server Admins can manage custom commands.'));
      }
      
      if (args.length === 0) {
        return message.reply(cv2.warn('Custom Commands', 'Usage:\n`!ccmd create <short> <command>`\n`!ccmd delete <short>`\n`!ccmd list`'));
      }
      
      const action = args[0].toLowerCase();
      const config = db.getGuildConfig(message.guild.id);
      const ccmds = config.customCommands || {};

      if (action === 'create' || action === 'add') {
        if (args.length < 3) return message.reply(cv2.warn('Invalid Usage', 'Usage: `!ccmd create <short> <actual_command>`'));
        const alias = args[1].toLowerCase();
        const actual = args[2].toLowerCase();
        
        if (!commandMap.has(actual)) {
          return message.reply(cv2.danger('Command Not Found', `The command \`${actual}\` does not exist in Athena.`));
        }
        if (commandMap.has(alias)) {
          return message.reply(cv2.danger('Alias Conflict', `The alias \`${alias}\` is already a built-in Athena command.`));
        }
        
        ccmds[alias] = actual;
        db.updateGuildConfig(message.guild.id, { customCommands: ccmds });
        return message.reply(cv2.success('Shortcut Created', `Typing \`!${alias}\` will now execute \`!${actual}\`.`));
      }
      else if (action === 'delete' || action === 'remove') {
        if (args.length < 2) return message.reply(cv2.warn('Invalid Usage', 'Usage: `!ccmd delete <short>`'));
        const alias = args[1].toLowerCase();
        if (!ccmds[alias]) return message.reply(cv2.danger('Shortcut Not Found', `The shortcut \`${alias}\` does not exist.`));
        
        delete ccmds[alias];
        db.updateGuildConfig(message.guild.id, { customCommands: ccmds });
        return message.reply(cv2.success('Shortcut Deleted', `\`!${alias}\` shortcut removed.`));
      }
      else if (action === 'list') {
        const keys = Object.keys(ccmds);
        if (keys.length === 0) return message.reply(cv2.info('Custom Commands', 'No custom command shortcuts have been set for this server.'));
        
        const fields = keys.map(k => ({ name: `!${k}`, value: `Executes \`!${ccmds[k]}\``, inline: true }));
        return message.reply({ components: [cv2.buildContainer('Custom Command Shortcuts', 'Configured aliases for this server:', fields)], flags: 16384 });
      }
    }
  }
];
