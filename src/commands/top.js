import { AttachmentBuilder, ApplicationCommandOptionType } from 'discord.js';
import statsDB from '../statsDB.js';
import { generateTopImage } from '../utils/statCanvas.js';
import embed from '../embed.js';

export const commands = [
  {
    name: 'top',
    description: 'View the top message and voice members in this server',
    aliases: ['leaderboard', 'lb', 'topmsg', 'toplb', 'toplist'],
    category: 'utility',
    options: [], // removed type option

    async executePrefix(message, args) {
      const waitMsg = await message.reply({ embeds: [embed.info('Loading...', 'Building top members leaderboard...')] });

      try {
        const rawMsgTop = statsDB.getTopMembers(message.guild.id, 5) || [];
        const rawVoiceTop = statsDB.getTopVoiceMembers(message.guild.id, 5) || [];

        if (rawMsgTop.length === 0 && rawVoiceTop.length === 0) {
          return waitMsg.edit({ embeds: [embed.info('No Data', 'No activity data found for this server yet.')] });
        }

        const resolveMembers = async (rawTop) => {
          return Promise.all(rawTop.map(async (row) => {
            try {
              const member = await message.guild.members.fetch(row.user_id).catch(() => null);
              const username = member?.user?.username
                || member?.displayName
                || (await message.client.users.fetch(row.user_id).catch(() => null))?.username
                || `User ${row.user_id.slice(-4)}`;
              return { user_id: row.user_id, username, total: row.total };
            } catch {
              return { user_id: row.user_id, username: `User ${row.user_id.slice(-4)}`, total: row.total };
            }
          }));
        };

        const topMsgMembers = await resolveMembers(rawMsgTop);
        const topVoiceMembers = await resolveMembers(rawVoiceTop);

        const buffer = await generateTopImage(message.guild, topMsgMembers, topVoiceMembers);
        const attachment = new AttachmentBuilder(buffer, { name: 'top-members.png' });

        await waitMsg.delete().catch(() => null);
        await message.channel.send({ files: [attachment] });
      } catch (e) {
        console.error('Top leaderboard error:', e);
        await waitMsg.edit({ embeds: [embed.danger('Error', 'Failed to generate leaderboard image.')] });
      }
    },

    async executeSlash(interaction) {
      await interaction.deferReply();

      try {
        const rawMsgTop = statsDB.getTopMembers(interaction.guild.id, 5) || [];
        const rawVoiceTop = statsDB.getTopVoiceMembers(interaction.guild.id, 5) || [];

        if (rawMsgTop.length === 0 && rawVoiceTop.length === 0) {
          return interaction.editReply({ embeds: [embed.info('No Data', 'No activity data found for this server yet.')] });
        }

        const resolveMembers = async (rawTop) => {
          return Promise.all(rawTop.map(async (row) => {
            try {
              const member = await interaction.guild.members.fetch(row.user_id).catch(() => null);
              const username = member?.user?.username
                || member?.displayName
                || (await interaction.client.users.fetch(row.user_id).catch(() => null))?.username
                || `User ${row.user_id.slice(-4)}`;
              return { user_id: row.user_id, username, total: row.total };
            } catch {
              return { user_id: row.user_id, username: `User ${row.user_id.slice(-4)}`, total: row.total };
            }
          }));
        };

        const topMsgMembers = await resolveMembers(rawMsgTop);
        const topVoiceMembers = await resolveMembers(rawVoiceTop);

        const buffer = await generateTopImage(interaction.guild, topMsgMembers, topVoiceMembers);
        const attachment = new AttachmentBuilder(buffer, { name: 'top-members.png' });

        await interaction.editReply({ files: [attachment] });
      } catch (e) {
        console.error('Top leaderboard slash error:', e);
        await interaction.editReply({ embeds: [embed.danger('Error', 'Failed to generate leaderboard image.')] });
      }
    }
  }
];
