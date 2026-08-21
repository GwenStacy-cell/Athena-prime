import { AttachmentBuilder } from 'discord.js';
import statsDB from '../statsDB.js';
import { generateServerOverviewImage } from '../utils/statCanvas.js';
import cv2 from '../cv2.js';

export const commands = [
  {
    name: 'serveroverview',
    slashHidden: true,
    description: 'View a highly detailed graphical overview of server statistics',
    // Statbot-style aliases: s•server
    aliases: ['server', 'serverstat', 'serverview'],
    async executePrefix(message, args) {
      const waitMsg = await message.reply(cv2.info('Analyzing...', 'Crunching server data and rendering dashboard...'));
      
      try {
        const stats = statsDB.getServerOverviewStats(message.guild.id);
        const buffer = await generateServerOverviewImage(message.guild, stats);
        const attachment = new AttachmentBuilder(buffer, { name: 'server-overview.png' });
        
        const c = cv2.buildContainer(null, null, []);
        await message.channel.send({ components: [c], files: [attachment], flags: 32768 });
        await waitMsg.delete().catch(() => null);
      } catch (e) {
        console.error('Server overview error:', e);
        await waitMsg.edit(cv2.error('Error', 'Failed to generate server overview dashboard.'));
      }
    },
    async executeSlash(interaction) {
      await interaction.deferReply();
      
      try {
        const stats = statsDB.getServerOverviewStats(interaction.guild.id);
        const buffer = await generateServerOverviewImage(interaction.guild, stats);
        const attachment = new AttachmentBuilder(buffer, { name: 'server-overview.png' });
        
        const c = cv2.buildContainer(null, null, []);
        await interaction.editReply({ components: [c], files: [attachment], flags: 32768 });
      } catch (e) {
        console.error('Server overview error:', e);
        await interaction.editReply(cv2.error('Error', 'Failed to generate server overview dashboard.'));
      }
    }
  }
];
