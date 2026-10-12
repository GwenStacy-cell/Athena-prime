import { PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import statsDB from '../statsDB.js';
import { calculateXpForLevel } from '../utils/xpEngine.js';
import { generateProfileCard } from '../utils/canvasCards.js';

export const commands = [
  {
    name: 'profile',
    aliases: ['userprofile', 'card'],
    description: 'Renders an official God of War aesthetic profile card with levels, voice, and stats.',
    category: 'utility',
    permissions: [],
    options: [
      { name: 'user', description: 'Member whose profile to view', type: 6, required: false }
    ],
    async executePrefix(message, args) {
      const target = message.mentions.members.first() || 
        (args[0] ? await message.guild.members.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null) : null) || 
        message.member;

      if (!target) {
        const errorContainer = {
          type: 17,
          components: [
            {
              type: 10,
              content:
                `# Member Not Found\n` +
                `-# • **Issue:** **__Unable to locate the specified member in this server.__**`
            }
          ]
        };
        return message.reply({ components: [errorContainer], flags: 32768 });
      }

      // Fetch user XP & Rank
      const userXp = db.getUserXp(message.guild.id, target.id);
      const level = userXp.level || 0;
      const xp = userXp.xp || 0;
      const requiredXp = calculateXpForLevel(level + 1);

      // Fetch Guild Leaderboard to find accurate Rank
      const allUsers = db.getAllUsersXp(message.guild.id);
      allUsers.sort((a, b) => b.xp - a.xp);
      const rankIndex = allUsers.findIndex(u => u.userId === target.id);
      const rank = rankIndex !== -1 ? rankIndex + 1 : 1;

      // Fetch Message & Voice Stats from statsDB
      let messages = 0;
      let voiceSeconds = 0;
      try {
        const userStats = statsDB.getUserStats(message.guild.id, target.id, 30);
        messages = userStats.messages || 0;
        voiceSeconds = userStats.voiceSeconds || 0;
      } catch {}

      const card = await generateProfileCard(
        target,
        { xp, level, rank, requiredXp },
        { messages, voiceSeconds },
        message.guild
      );

      const profileContainer = {
        type: 17,
        components: [
          {
            type: 10,
            content:
              `# Profile Overview — ${target.displayName}\n` +
              `-# • **Member:** ${target} (\`${target.id}\`)\n` +
              `-# • **Server Standing:** **__Level ${level} Warrior__** \u2022 **Rank #${rank}**`
          },
          {
            type: 12,
            items: [
              { media: { url: 'attachment://profile_card.png' } }
            ]
          },
          { type: 14, divider: true },
          {
            type: 10,
            content: '-# Athena Prime God of War Engine • V1.0.0'
          }
        ]
      };

      return message.reply({ components: [profileContainer], files: [card], flags: 32768 });
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null) || interaction.member;

      const userXp = db.getUserXp(interaction.guild.id, target.id);
      const level = userXp.level || 0;
      const xp = userXp.xp || 0;
      const requiredXp = calculateXpForLevel(level + 1);

      const allUsers = db.getAllUsersXp(interaction.guild.id);
      allUsers.sort((a, b) => b.xp - a.xp);
      const rankIndex = allUsers.findIndex(u => u.userId === target.id);
      const rank = rankIndex !== -1 ? rankIndex + 1 : 1;

      let messages = 0;
      let voiceSeconds = 0;
      try {
        const userStats = statsDB.getUserStats(interaction.guild.id, target.id, 30);
        messages = userStats.messages || 0;
        voiceSeconds = userStats.voiceSeconds || 0;
      } catch {}

      const card = await generateProfileCard(
        target,
        { xp, level, rank, requiredXp },
        { messages, voiceSeconds },
        interaction.guild
      );

      const profileContainer = {
        type: 17,
        components: [
          {
            type: 10,
            content:
              `# Profile Overview — ${target.displayName}\n` +
              `-# • **Member:** ${target} (\`${target.id}\`)\n` +
              `-# • **Server Standing:** **__Level ${level} Warrior__** \u2022 **Rank #${rank}**`
          },
          {
            type: 12,
            items: [
              { media: { url: 'attachment://profile_card.png' } }
            ]
          },
          { type: 14, divider: true },
          {
            type: 10,
            content: '-# Athena Prime God of War Engine • V1.0.0'
          }
        ]
      };

      return interaction.reply({ components: [profileContainer], files: [card], flags: 32768 });
    }
  }
];
