import embed from '../embed.js';
import db from '../database.js';

export const commands = [{
  name: 'afk',
  description: 'Set your AFK status',
  async executePrefix(message, args) {
    const reason = args.length > 0 ? args.join(' ') : 'AFK';
    const timestamp = Date.now();
    
    db.setAfk(message.author.id, reason, timestamp);

    const afkEmbed = embed.build({
      title: 'AFK Status Activated',
      description: `<:emoji_16:1521464002046328944> **Status Activated**\n**User:** ${message.author}\n**Reason:** ${reason}\n\n*your afk status will be removed upon next message*`,
      color: '#2b2d31', // Aesthetic dark grey
      thumbnail: message.author.displayAvatarURL({ dynamic: true })
    });

    await message.reply({ embeds: [afkEmbed] });
  }
}];
