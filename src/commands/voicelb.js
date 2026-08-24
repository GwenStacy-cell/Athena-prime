import { AttachmentBuilder } from 'discord.js';
import statsDB from '../statsDB.js';
import { generateVoiceTopImage } from '../utils/statCanvas.js';
import cv2 from '../cv2.js';

export const commands = [
  {
    name: 'voicelb',
    slashHidden: true,
    description: 'View the top voice chat users in this server',
    aliases: ['voiceleaderboard', 'topvoice'],
    category: 'utility',
    options: [],

    async executePrefix(message, args) {
      const waitMsg = await message.reply(cv2.info('Loading...', 'Building voice leaderboard...'));

      try {
        const rawMembers = statsDB.getTopVoiceMembers(message.guild.id, 10) || [];

        if (rawMembers.length === 0) {
          return waitMsg.edit(cv2.info('No Data', 'No voice data found for this server yet.'));
        }

        const resolveMembers = async (rawTop) => {
          return Promise.all(rawTop.map(async (row) => {
            try {
              const member = await message.guild.members.fetch(row.user_id).catch(() => null);
              const username = member?.user?.username
                || member?.displayName
                || (await message.client.users.fetch(row.user_id).catch(() => null))?.username
                || `User ${row.user_id.slice(-4)}`;
              // Voice total is in minutes, so we convert it to a formatted string like '12h 30m' or just hours
              const totalMins = Math.floor(row.total / 60);
              const hours = Math.floor(totalMins / 60);
              const mins = totalMins % 60;
              const formattedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
              return { user_id: row.user_id, username, total: formattedTime };
            } catch {
              const totalMins = Math.floor(row.total / 60);
              const hours = Math.floor(totalMins / 60);
              const mins = totalMins % 60;
              const formattedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
              return { user_id: row.user_id, username: `User ${row.user_id.slice(-4)}`, total: formattedTime };
            }
          }));
        };

        const resolvedMembers = await resolveMembers(rawMembers);

        const buffer = await generateVoiceTopImage(message.guild, resolvedMembers);
        const attachment = new AttachmentBuilder(buffer, { name: 'voicelb.png' });

        await waitMsg.delete().catch(() => null);
        await message.channel.send({ files: [attachment] });

      } catch (error) {
        console.error('VoiceLB Error:', error);
        await waitMsg.edit(cv2.danger('Error', 'Failed to generate voice leaderboard.'));
      }
    }
  }
];
