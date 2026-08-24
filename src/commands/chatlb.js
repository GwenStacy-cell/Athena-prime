import { AttachmentBuilder } from 'discord.js';
import statsDB from '../statsDB.js';
import { generateChatTopImage } from '../utils/statCanvas.js';
import cv2 from '../cv2.js';

export const commands = [
  {
    name: 'chatlb',
    slashHidden: true,
    description: 'View the top chatters in this server',
    aliases: ['chatleaderboard', 'topchat'],
    category: 'utility',
    options: [],

    async executePrefix(message, args) {
      const waitMsg = await message.reply(cv2.info('Loading...', 'Building chat leaderboard...'));

      try {
        const rawMembers = statsDB.getTopMembers(message.guild.id, 10) || [];

        if (rawMembers.length === 0) {
          return waitMsg.edit(cv2.info('No Data', 'No chat data found for this server yet.'));
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

        const resolvedMembers = await resolveMembers(rawMembers);

        const buffer = await generateChatTopImage(message.guild, resolvedMembers);
        const attachment = new AttachmentBuilder(buffer, { name: 'chatlb.png' });

        await waitMsg.delete().catch(() => null);
        await message.channel.send({ files: [attachment] });

      } catch (error) {
        console.error('ChatLB Error:', error);
        await waitMsg.edit(cv2.danger('Error', 'Failed to generate chat leaderboard.'));
      }
    }
  }
];
