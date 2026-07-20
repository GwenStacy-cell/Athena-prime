import { AttachmentBuilder, ApplicationCommandOptionType } from 'discord.js';
import statsDB from '../statsDB.js';
import { generateTopImage } from '../utils/statCanvas.js';
import embed from '../embed.js';

export const commands = [
  {
    name: 'top',
    description: 'View the top message members in this server',
    // Statbot-style aliases: s?top
    aliases: ['leaderboard', 'lb', 'topmsg', 'toplb', 'toplist'],
    category: 'utility',
    options: [
      {
        name: 'type',
        description: 'What to rank by',
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: 'Messages', value: 'messages' },
          { name: 'Voice', value: 'voice' }
        ]
      }
    ],

    async executePrefix(message, args) {
      const type = args[0]?.toLowerCase() === 'voice' || args[0]?.toLowerCase() === 'vc' ? 'voice' : 'messages';

      const waitMsg = await message.reply({ embeds: [embed.info('Loading...', 'Building top members leaderboard...')] });

      try {
        const rawTop = type === 'voice'
          ? statsDB.getTopVoiceMembers(message.guild.id, 10)
          : statsDB.getTopMembers(message.guild.id, 10);

        if (!rawTop || rawTop.length === 0) {
          return waitMsg.edit({ embeds: [embed.info('No Data', 'No activity data found for this server yet.')] });
        }

        // Resolve usernames
        const topMembers = await Promise.all(rawTop.map(async (row) => {
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

        const buffer = await generateTopImage(message.guild, topMembers, type);
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
      const type = interaction.options.getString('type') || 'messages';

      try {
        const rawTop = type === 'voice'
          ? statsDB.getTopVoiceMembers(interaction.guild.id, 10)
          : statsDB.getTopMembers(interaction.guild.id, 10);

        if (!rawTop || rawTop.length === 0) {
          return interaction.editReply({ embeds: [embed.info('No Data', 'No activity data found for this server yet.')] });
        }

        const topMembers = await Promise.all(rawTop.map(async (row) => {
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

        const buffer = await generateTopImage(interaction.guild, topMembers, type);
        const attachment = new AttachmentBuilder(buffer, { name: 'top-members.png' });

        await interaction.editReply({ files: [attachment] });
      } catch (e) {
        console.error('Top leaderboard slash error:', e);
        await interaction.editReply({ embeds: [embed.danger('Error', 'Failed to generate leaderboard image.')] });
      }
    }
  }
];
