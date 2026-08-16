import db from '../database.js';
import { MessageFlags } from 'discord.js';

export const commands = [{
  name: 'afk',
  slashHidden: true,
  description: 'Set your AFK status',
  async executePrefix(message, args) {
    const reason = args.length > 0 ? args.join(' ') : 'AFK';
    const timestamp = Date.now();
    db.setAfk(message.author.id, reason, timestamp);

    const avatarUrl = message.author.displayAvatarURL({ dynamic: true, size: 128 });

    const container = {
      type: 17,
      components: [
        {
          type: 9,
          components: [{ type: 10, content: `## **AFK Set**\n-# **${message.author.username} is now AFK**\n-# **Reason: ${reason}**` }],
          accessory: { type: 11, media: { url: avatarUrl } }
        },
        { type: 14, divider: true }
      ]
    };

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  }
}];