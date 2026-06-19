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
  if (system.levelChannelId) {
    const channel = guild.channels.cache.get(system.levelChannelId);
    if (channel) {
      const bearCheer = '<a:bear_cheer:1517636380526645491>';
      let desc = `Congratulations <@${member.id}>! You just advanced to **Level ${newLevel}**! ${bearCheer}`;
      if (rewardGiven) {
        desc += `\n\n🎉 You also unlocked the **${rewardName}** role!`;
      }
      
      const levelUpEmbed = embed.success('Level Up!', desc);
      await channel.send({ content: `<@${member.id}>`, embeds: [levelUpEmbed] }).catch(() => null);
    }
  }
}
