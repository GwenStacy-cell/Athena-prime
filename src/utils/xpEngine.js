import db from '../database.js';
import embed from '../embed.js';

// Base formula constants (making it hard to level up)
const BASE_XP = 100;
const MULTIPLIER = 100;

export function calculateXpForLevel(level) {
  // Formula: 100 * (level^2) + 100 * level
  return BASE_XP * Math.pow(level, 2) + MULTIPLIER * level;
}

export function calculateLevel(xp) {
  // Inverse of the formula to find the level from total XP
  let level = 0;
  while (calculateXpForLevel(level + 1) <= xp) {
    level++;
  }
  return level;
}

export function getRandomXp(min = 15, max = 25) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRoleMultiplier(guildId, member) {
  const system = db.getXpSystem(guildId);
  if (!system || !system.enabled) return 1;

  let maxMultiplier = 1;
  for (const [roleId, mult] of Object.entries(system.multipliers)) {
    if (member.roles.cache.has(roleId)) {
      if (mult > maxMultiplier) maxMultiplier = mult;
    }
  }
  return maxMultiplier;
}

export async function processLevelUp(client, guild, member, newLevel) {
  const system = db.getXpSystem(guild.id);
  if (!system || !system.enabled) return;

  // 1. Role Rewards
  let rewardGiven = false;
  let rewardName = '';
  const roleRewardId = system.roleRewards[String(newLevel)];
  if (roleRewardId) {
    const role = guild.roles.cache.get(roleRewardId);
    if (role) {
      await member.roles.add(role).catch(() => null);
      rewardGiven = true;
      rewardName = role.name;
    }
  }

  // 2. Announcements
  if (system.announceChannelId) {
    const channel = guild.channels.cache.get(system.announceChannelId);
    if (channel) {
      const { generateRankCard } = await import('./canvasCards.js');
      const allUsers = db.getTopUsersXp(guild.id, 99999);
      let rank = allUsers.findIndex(u => u.userId === member.id) + 1;
      if (rank === 0) rank = '-';
      
      const userXp = db.getUserXp(guild.id, member.id);
      const requiredXp = calculateXpForLevel(newLevel + 1);
      const remainingXp = requiredXp - userXp.xp;
      
      const attachment = await generateRankCard(member, userXp.xp, newLevel, rank, requiredXp);

      const HEART = '<a:redheart:1533024105606156470>';
      const FLAME = '<a:RED:1533859934146396312>';
      const BOOK = '<a:emoji_29:1533844915988201624>';

      let description = `Congratulations <@${member.id}>! You have leveled up to **Level ${newLevel}**! ${FLAME}\n\n`;
      if (rewardGiven) {
        description += `**Milestone Reached!** ${HEART}\nYou have been rewarded with the **${rewardName}** role!\n\n`;
      }
      description += `${BOOK} **Next Milestone Progress:**\nYou need **${remainingXp} more XP** to reach Level ${newLevel + 1}. Keep chatting and staying active in voice channels!`;

      const announcementEmbed = embed.success('Level Up!', description).setImage('attachment://rank-card.png');

      await channel.send({ content: `<@${member.id}>`, embeds: [announcementEmbed], files: [attachment] }).catch(() => null);
    }
  }
}
