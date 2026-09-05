import cv2 from '../cv2.js';
import db from '../database.js';
import { isBotOwnerSync } from '../utils/helpers.js';

export const commands = [
  {
    name: 'learn',
    description: 'Toggle Anti-Nuke Machine Learning Mode (Records Audit Logs to DB)',
    category: 'security',
    permissions: [],
    async executePrefix(message, args) {
      const isOwner = isBotOwnerSync(message.author.id);
      if (!isOwner && message.author.id !== message.guild.ownerId && !db.isExtraOwner(message.guild.id, message.author.id)) {
        return message.reply(cv2.danger('Access Denied', 'Only the Server Owner or Athena Administrators can enable Learn Mode.'));
      }

      const config = db.getGuildConfig(message.guild.id);
      const isLearning = config.learnModeEnabled;

      if (isLearning) {
        config.learnModeEnabled = false;
        db.updateGuildConfig(message.guild.id, { learnModeEnabled: false });
        
        const count = (db.cache.nukeSignatures || []).filter(s => s.guildId === message.guild.id).length;
        
        return message.reply(cv2.success('Learn Mode Deactivated', `Athena has exited Neural Training Mode.\\n\\nSuccessfully recorded **\${count}** heuristic nuke signatures into the database.\\nThe Anti-Nuke engine is now **ARMED** and enforcing thresholds.`));
      } else {
        config.learnModeEnabled = true;
        db.updateGuildConfig(message.guild.id, { learnModeEnabled: true });
        
        return message.reply(cv2.warn('Neural Training Mode Engaged', `Athena is now natively recording all high-velocity audit log actions.\\n\\n⚠️ **Anti-Nuke punishments are temporarily BYPASSED.**\\nDo your simulated nuke, and Athena will memorize the exact API signatures into the database.\\n\\nType \`!learn\` again to exit and re-arm the shields.`));
      }
    }
  }
];
