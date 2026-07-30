import db from '../database.js';
import embed from '../embed.js';
import { logServerEvent } from '../utils/serverLogger.js';
export default {
  name: 'messageDelete',
  execute(message) {
    if (!message.guild) return;

    // Check if the deleted message was a reaction role menu, and if so, clean it up from the database
    const rrConfig = db.getReactionRoleMenu(message.id);
    if (rrConfig) {
      db.deleteReactionRoleMenu(message.id);
      console.log(`[Reaction Roles] Automatically cleaned up deleted menu: ${message.id}`);
    }

    if (message.author?.bot) return; // Don't log bot message deletions to prevent spam

    const content = message.content ? (message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content) : 'No text content';
    
    const delEmbed = embed.danger(
      'Message Deleted',
      `**Author:** ${message.author?.tag || 'Unknown'} (<@${message.author?.id || 'Unknown'}>)\n**Channel:** ${message.channel}\n\n**Content:**\n${content}`
    );

    logServerEvent(message.guild, 'msgDeletes', delEmbed);
  }
};
