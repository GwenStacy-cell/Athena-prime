import { PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import db from '../database.js';
import statsDB from '../statsDB.js';
import { generateStatCard } from '../utils/statCanvas.js';
import embed from '../embed.js';

export const commands = [
  {
    name: 'stats',
    description: 'View server statistics and insights',
    // Statbot-style aliases: s?me, s?u, s?stats, s?statsme
    aliases: ['me', 'u', 'statsme', 'statme', 'mystat', 'mystats'],
    category: 'utility',
    options: [
      {
        name: 'me',
        description: 'View your own statistics',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'user',
        description: 'View statistics of a specific user',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'target',
            description: 'The user to view stats for',
            type: 6, // USER
            required: true
          }
        ]
      }
    ],
    async executeSlash(interaction) {
      const cfg = db.getGuildConfig(interaction.guild.id);
      if (cfg.statsChannelId && interaction.channel.id !== cfg.statsChannelId) {
        return interaction.reply({ embeds: [embed.warn('Wrong Channel', `Please use this command in <#${cfg.statsChannelId}>.`)] });
      }

      await interaction.deferReply();
      const subcommand = interaction.options.getSubcommand();
      let targetUser = interaction.user;
      let targetMember = interaction.member;

      if (subcommand === 'user') {
        const providedUser = interaction.options.getUser('target');
        targetUser = providedUser;
        targetMember = await interaction.guild.members.fetch(providedUser.id).catch(() => null);
      }

      const guildId = interaction.guild.id;
      const userId = targetUser.id;

      // Fetch data
      const userStats = statsDB.getUserStats(guildId, userId);
      const serverRanks = statsDB.getServerRanks(guildId, userId);
      const topChannels = statsDB.getTopChannels(guildId, userId);
      const chartData = statsDB.getChartData(guildId, userId);

      // Verify they have some data
      if (userStats.msg_14d === 0 && userStats.vc_14d === 0) {
        return interaction.editReply({ embeds: [embed.info('No Data', `${targetUser} has not sent any messages or joined any voice channels in the last 14 days.`)] });
      }

      try {
        const buffer = await generateStatCard(targetUser, targetMember, userStats, serverRanks, topChannels, chartData, interaction.guild);
        const attachment = new AttachmentBuilder(buffer, { name: 'statbot-card.png' });
        
        await interaction.editReply({ files: [attachment] });
      } catch (err) {
        console.error('Failed to generate stat card:', err);
        await interaction.editReply({ embeds: [embed.danger('Error', 'Failed to generate statistics card. Please try again later.')] });
      }
    },
    executePrefix: async (message, args) => {
      const cfg = db.getGuildConfig(message.guild.id);
      if (cfg.statsChannelId && message.channel.id !== cfg.statsChannelId) {
        return message.reply({ embeds: [embed.warn('Wrong Channel', `Please use this command in <#${cfg.statsChannelId}>.`)] }).catch(() => null);
      }

      let targetUser = message.author;
      let targetMember = message.member;

      // Check if they typed !statsme or !stats me
      const isMe = message.content.toLowerCase().includes('statsme') || args[0]?.toLowerCase() === 'me';
      const mentionedUser = message.mentions.users.first();

      if (mentionedUser) {
        targetUser = mentionedUser;
        targetMember = message.mentions.members.first() || await message.guild.members.fetch(mentionedUser.id).catch(() => null);
      } else if (!isMe && args[0]) {
        const id = args[0].replace(/[<@!>]/g, '');
        if (id) {
          const member = await message.guild.members.fetch(id).catch(() => null);
          if (member) {
            targetUser = member.user;
            targetMember = member;
          }
        }
      }

      const guildId = message.guild.id;
      const userId = targetUser.id;

      // Fetch data
      const userStats = statsDB.getUserStats(guildId, userId);
      const serverRanks = statsDB.getServerRanks(guildId, userId);
      const topChannels = statsDB.getTopChannels(guildId, userId);
      const chartData = statsDB.getChartData(guildId, userId);

      // Verify they have some data
      if (userStats.msg_14d === 0 && userStats.vc_14d === 0) {
        return message.reply({ embeds: [embed.info('No Data', `${targetUser} has not sent any messages or joined any voice channels in the last 14 days.`)] });
      }

      const m = await message.reply(' Generating your stats... Please wait.');

      try {
        const buffer = await generateStatCard(targetUser, targetMember, userStats, serverRanks, topChannels, chartData, message.guild);
        const attachment = new AttachmentBuilder(buffer, { name: 'statbot-card.png' });
        
        await m.edit({ content: '', files: [attachment] });
      } catch (err) {
        console.error('Failed to generate stat card via prefix:', err);
        await m.edit({ content: '', embeds: [embed.danger('Error', 'Failed to generate statistics card. Please try again later.')] });
      }
    }
  }
];
