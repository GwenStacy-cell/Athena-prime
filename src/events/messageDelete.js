import db from '../database.js';

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
  }
};
