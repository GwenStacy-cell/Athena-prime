import { PermissionFlagsBits, ChannelType, OverwriteType } from 'discord.js';
import db from '../database.js';

/**
 * Parses simple duration strings (e.g. 10s, 5m, 2h, 1d) into milliseconds
 */
export function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60000;
    case 'h': return value * 3600000;
    case 'd': return value * 86400000;
    default: return null;
  }
}

/**
 * Validates if the moderator has sufficient permission to moderate the target
 */
export function canModerate(moderator, target) {
  if (moderator.id === target.id) return false;
  if (moderator.guild.ownerId === target.id) return false; // Owner is unmoderatable
  if (moderator.id === moderator.guild.ownerId) return true; // Owner can moderate anyone
  
  // Compare role positions
  return moderator.roles.highest.position > target.roles.highest.position;
}

/**
 * Logs an action or security threat to the designated logs channel
 */
export async function logToSecurityChannel(guild, embedObject) {
  try {
    const config = db.getGuildConfig(guild.id);
    let channel = null;

    if (config.logChannel) {
      channel = await guild.channels.fetch(config.logChannel).catch(() => null);
    }

    if (!channel) {
      // Fallback search by name
      channel = guild.channels.cache.find(c => c.name === 'security-logs' && c.type === ChannelType.GuildText);
      
      // If still not found, create it dynamically
      if (!channel) {
        channel = await guild.channels.create({
          name: 'security-logs',
          type: ChannelType.GuildText,
          topic: '🛡️ Automated security audits and moderation records',
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel] // Hide from normal members
            }
          ]
        }).catch(() => null);

        if (channel) {
          db.updateGuildConfig(guild.id, { logChannel: channel.id });
        }
      }
    }

    if (channel) {
      await channel.send({ embeds: [embedObject] });
    }
  } catch (error) {
    console.error('Error logging to security logs channel:', error);
  }
}

/**
 * Dynamically resolves or creates a standard isolated Quarantine role
 */
export async function getOrCreateQuarantineRole(guild) {
  const config = db.getGuildConfig(guild.id);
  let role = null;

  if (config.quarantineRoleId) {
    role = await guild.roles.fetch(config.quarantineRoleId).catch(() => null);
  }

  if (!role) {
    role = guild.roles.cache.find(r => r.name === 'Quarantined');
    if (!role) {
      role = await guild.roles.create({
        name: 'Quarantined',
        color: '#ff3333',
        hoist: true,
        reason: 'Sentinel automatic quarantine role creation',
        permissions: [] // Zero global permissions
      }).catch(() => null);
    }

    if (role) {
      db.updateGuildConfig(guild.id, { quarantineRoleId: role.id });
    }
  }

  return role;
}

/**
 * Resolves or builds a single channel where quarantined members are restricted to talk and view
 */
export async function getOrCreateQuarantineChannel(guild, quarantineRole) {
  const config = db.getGuildConfig(guild.id);
  let channel = null;

  if (config.quarantineChannelId) {
    channel = await guild.channels.fetch(config.quarantineChannelId).catch(() => null);
  }

  if (!channel) {
    channel = guild.channels.cache.find(c => c.name === 'quarantine-zone' && c.type === ChannelType.GuildText);
    
    if (!channel) {
      channel = await guild.channels.create({
        name: 'quarantine-zone',
        type: ChannelType.GuildText,
        topic: '🔒 Under Investigation - Restricted Access Area',
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel] // Normal users can't see it
          },
          {
            id: quarantineRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ] // Restricted user can view/talk here
          }
        ]
      }).catch(() => null);
    }

    if (channel) {
      db.updateGuildConfig(guild.id, { quarantineChannelId: channel.id });
    }
  }

  return channel;
}
