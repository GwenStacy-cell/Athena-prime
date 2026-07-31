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
    
    const delEmbed = embed.build({
      description: `__**Message Deleted |**__ <:emoji_16:1521464002046328944>\n> **Author:** ${message.author?.tag || 'Unknown'} (<@${message.author?.id || 'Unknown'}>)\n> \n>  **Channel:** ${message.channel}\n>  **Content:**\n>  ${content}`,
      color: '#2b2d31'
    });

    logServerEvent(message.guild, 'msgDeletes', delEmbed);
  }
};
