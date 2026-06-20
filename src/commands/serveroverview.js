import { AttachmentBuilder } from 'discord.js';
import statsDB from '../statsDB.js';
import { generateServerOverviewImage } from '../utils/statCanvas.js';
import embed from '../embed.js';

export const commands = [
  {
    name: 'serveroverview',
    description: 'View a highly detailed graphical overview of server statistics',
    async executePrefix(message, args) {
      const waitMsg = await message.reply({ embeds: [embed.info('Analyzing...', 'Crunching server data and rendering dashboard...')] });
      
      try {
        const stats = statsDB.getServerOverviewStats(message.guild.id);
        const buffer = await generateServerOverviewImage(message.guild, stats);
        const attachment = new AttachmentBuilder(buffer, { name: 'server-overview.png' });
        
        await message.channel.send({ files: [attachment] });
        await waitMsg.delete().catch(() => null);
      } catch (e) {
        console.error('Server overview error:', e);
        await waitMsg.edit({ embeds: [embed.error('Error', 'Failed to generate server overview dashboard.')] });
      }
    },
    async executeSlash(interaction) {
      await interaction.deferReply();
      
      try {
        const stats = statsDB.getServerOverviewStats(interaction.guild.id);
        const buffer = await generateServerOverviewImage(interaction.guild, stats);
        const attachment = new AttachmentBuilder(buffer, { name: 'server-overview.png' });
        
        await interaction.editReply({ files: [attachment] });
      } catch (e) {
        console.error('Server overview error:', e);
        await interaction.editReply({ embeds: [embed.error('Error', 'Failed to generate server overview dashboard.')] });
      }
    }
  }
];
