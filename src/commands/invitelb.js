import { AttachmentBuilder } from 'discord.js';
import statsDB from '../statsDB.js';
import { generateInviteTopImage } from '../utils/statCanvas.js';
import cv2 from '../cv2.js';

export const commands = [
  {
    name: 'invitelb',
    slashHidden: true,
    description: 'View the top inviters in this server',
    aliases: ['topinvites', 'invitetop'],
    category: 'utility',
    options: [],

    async executePrefix(message, args) {
      const waitMsg = await message.reply(cv2.info('Loading...', 'Building invite leaderboard...'));

      try {
        const rawInvites = statsDB.getTopInvites(message.guild.id, 10) || [];

        if (rawInvites.length === 0) {
          return waitMsg.edit(cv2.info('No Data', 'No invite data found for this server yet.'));
        }

        const resolveMembers = async (rawTop) => {
          return Promise.all(rawTop.map(async (row) => {
            try {
              const member = await message.guild.members.fetch(row.user_id).catch(() => null);
              const username = member?.user?.username
                || member?.displayName
                || (await message.client.users.fetch(row.user_id).catch(() => null))?.username
                || `User ${row.user_id.slice(-4)}`;
              return { user_id: row.user_id, username, net: row.net };
            } catch {
              return { user_id: row.user_id, username: `User ${row.user_id.slice(-4)}`, net: row.net };
            }
          }));
        };

        const topInvites = await resolveMembers(rawInvites);

        const buffer = await generateInviteTopImage(message.guild, topInvites);
        const attachment = new AttachmentBuilder(buffer, { name: 'top-invites.png' });

        await waitMsg.delete().catch(() => null);
        await message.channel.send({ files: [attachment] });
      } catch (e) {
        console.error('Invite leaderboard error:', e);
        await waitMsg.edit(cv2.danger('Error', 'An error occurred while generating the leaderboard.')).catch(() => null);
      }
    }
  }
];
