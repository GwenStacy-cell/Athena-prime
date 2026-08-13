import db from '../database.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';

export const commands = [{
  name: 'afk',
  slashHidden: true,
  description: 'Set your AFK status',
  async executePrefix(message, args) {
    const reason = args.length > 0 ? args.join(' ') : 'AFK';
    const timestamp = Date.now();
    
    db.setAfk(message.author.id, reason, timestamp);

    const textContent = 
      `# AFK Set\n` +
      `-# **[${message.author.username}](https://discord.com/users/${message.author.id}) is now Afk**\n` +
      `-# **Reason: ${reason}**`;
      
    const display = new TextDisplayBuilder().setContent(textContent);
    const container = new ContainerBuilder().addTextDisplayComponents(display);
    
    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  }
}];
