import { PermissionFlagsBits, ChannelType } from 'discord.js';
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
 * Checks if a user is the hardcoded bot owner (from OWNER_ID env) or the application owner
 */
export async function isBotOwner(user, client = null) {
  const resolvedClient = client || user.client;
  
  // Check hardcoded OWNER_ID first (fastest)
  const ownerIdEnv = process.env.OWNER_ID;
  if (ownerIdEnv && user.id === ownerIdEnv) return true;
  if (HARDCODED_OWNER_IDS.includes(user.id)) return true;

  // Check application owner
  try {
    if (!resolvedClient.application.owner) {
      await resolvedClient.application.fetch();
    }
    const owner = resolvedClient.application.owner;
    if (owner) {
      if (owner.id) return user.id === owner.id;
      if (owner.members) return owner.members.has(user.id);
    }
  } catch (error) {
    console.error('Error checking bot owner:', error);
  }
  return false;
}

/**
 * Synchronous fast-check for bot owner using just the env variable (no API call)
 */
// Hardcoded fallback in case .env is not present on the server
const HARDCODED_OWNER_IDS = ['1423292960744804383'];

export function isBotOwnerSync(userId) {
  if (HARDCODED_OWNER_IDS.includes(userId)) return true;
  const ownerIdEnv = process.env.OWNER_ID;
  return userId === ownerIdEnv;
}

/**
 * Checks if a user is an extra owner (added by bot owner or server owner)
 */
export function isExtraOwner(guildId, userId) {
  return db.isExtraOwner(guildId, userId);
}

/**
 * Checks if a user is authorized to use bot commands.
 * Authorized users: bot owner, server owner, extra owners.
 * Returns true if authorized.
 */
export async function isAuthorized(user, guild) {
  // Bot owner is always authorized
  if (isBotOwnerSync(user.id)) return true;
  
  // Server owner is always authorized
  if (guild && user.id === guild.ownerId) return true;

  // Extra owners are authorized
  if (guild && db.isExtraOwner(guild.id, user.id)) return true;

  // Fall back to async bot owner check (application owner)
  const isOwner = await isBotOwner(user);
  if (isOwner) return true;

  return false;
}

/**
 * Checks if a user is immune to all moderation/security actions.
 * Immune users: bot owner, extra owners.
 * Server owner immunity is handled separately by canModerate().
 */
export async function isImmune(user, guild) {
  // Bot owner is always immune
  if (isBotOwnerSync(user.id)) return true;

  // Extra owners are immune
  if (guild && db.isExtraOwner(guild.id, user.id)) return true;

  // Async bot owner check
  const isOwner = await isBotOwner(user);
  if (isOwner) return true;

  return false;
}

/**
 * Validates if the moderator has sufficient permission to moderate the target.
 * Bot owner and extra owners CANNOT be moderated.
 */
export function canModerate(moderator, target) {
  if (moderator.id === target.id) return false;
  
  // Bot owner is UNMODERATABLE
  if (isBotOwnerSync(target.id)) return false;
  if (isBotOwnerSync(target.user?.id || target.id)) return false;
  
  // Extra owners are UNMODERATABLE
  if (target.guild && isExtraOwner(target.guild.id, target.id)) return false;
  
  // Server owner is unmoderatable
  if (moderator.guild.ownerId === target.id) return false;
  
  // Owner can moderate anyone
  if (moderator.id === moderator.guild.ownerId) return true;
  if (isBotOwnerSync(moderator.id)) return true;
  if (moderator.guild && isExtraOwner(moderator.guild.id, moderator.id)) return true;
  
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
          topic: 'ï¸ Automated security audits and moderation records â€” Athena Prime',
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
      role = await guild.roles.create({ name: 'Quarantined',
        colors: { primaryColor: '#ff0000' },
        hoist: true,
        reason: 'Athena Prime automatic quarantine role creation',
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
        topic: ' Under Investigation - Restricted Access Area â€” Athena Prime',
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

/**
 * Checks if a user is the bot application owner or the server owner
 */
export async function isBotOwnerOrServerOwner(user, guild) {
  if (guild && user.id === guild.ownerId) return true;

  // Check hardcoded OWNER_ID
  if (isBotOwnerSync(user.id)) return true;

  // Check extra owners
  if (guild && isExtraOwner(guild.id, user.id)) return true;
  
  const client = guild ? guild.client : user.client;
  try {
    if (!client.application.owner) {
      await client.application.fetch();
    }
    
    const owner = client.application.owner;
    if (owner) {
      if (owner.id) {
        return user.id === owner.id;
      } else if (owner.members) {
        return owner.members.has(user.id);
      }
    }
  } catch (error) {
    console.error('Error fetching application owner:', error);
  }
  return false;
}

/**
 * STRICT version â€” only bot owner OR server owner. Extra owners are NOT included.
 * Used for sensitive commands like setguildavatar and setguildbanner.
 */
export function isBotOwnerOrServerOwnerStrict(userId, guild) {
  if (isBotOwnerSync(userId)) return true;
  if (guild && userId === guild.ownerId) return true;
  return false;
}

/**
 * Levenshtein distance for fuzzy command matching
 */
export function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Find closest matching command name using fuzzy matching
 */
export function findClosestCommand(input, commandNames, maxDistance = 3) {
  let closest = null;
  let bestDistance = Infinity;

  for (const name of commandNames) {
    const dist = levenshteinDistance(input.toLowerCase(), name.toLowerCase());
    if (dist < bestDistance && dist <= maxDistance) {
      bestDistance = dist;
      closest = name;
    }
  }

  return closest;
}

/**
 * Iterates ALL guild channels and applies deny overwrites for the Quarantine role,
 * except the designated quarantine-zone channel.
 * Call this after creating the quarantine role/channel, or from qrmanager setup.
 */
export async function syncQuarantinePermissions(guild, quarantineRole, excludeChannelId = null) {
  if (!quarantineRole) return 0;

  // Ensure all channels are cached so we don't miss any after a bot restart
  await guild.channels.fetch().catch(() => null);

  // Collect ALL channel IDs that the quarantine role should be allowed to see
  // excludeChannelId is the quarantine TEXT channel
  const config = db.getGuildConfig(guild.id);
  const allowedChannelIds = new Set();
  if (excludeChannelId) allowedChannelIds.add(excludeChannelId);
  if (config.quarantineVcId) allowedChannelIds.add(config.quarantineVcId);

  let synced = 0;

  const allowedTypes = [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildCategory,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildForum,
    ChannelType.GuildStageVoice
  ];

  for (const [channelId, channel] of guild.channels.cache) {
    if (!allowedTypes.includes(channel.type)) continue;

    try {
      if (allowedChannelIds.has(channelId)) {
        // Quarantine zone channels â€” grant access
        if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
          await channel.permissionOverwrites.edit(quarantineRole, {
            ViewChannel:  true,
            Connect:      true,
            Speak:        false, // can hear but not speak by default
            SendMessages: false
          }, { reason: 'Athena Prime â€” quarantine VC access grant' });
        } else {
          await channel.permissionOverwrites.edit(quarantineRole, {
            ViewChannel:      true,
            SendMessages:     true,
            ReadMessageHistory: true,
            Connect:          false
          }, { reason: 'Athena Prime â€” quarantine text access grant' });
        }
      } else {
        // All other channels â€” fully deny
        await channel.permissionOverwrites.edit(quarantineRole, {
          ViewChannel:  false,
          SendMessages: false,
          Connect:      false,
          Speak:        false
        }, { reason: 'Athena Prime â€” quarantine permission sync' });
      }
      synced++;
    } catch { /* Skip channels where bot lacks manage permissions */ }
  }

  return synced;
}

/**
 * Get the owner's presence status string and emoji
 */
export function getPresenceStatus(guild, ownerId) {
  try {
    const member = guild.members.cache.get(ownerId);
    if (!member) return { text: 'UNKNOWN', emoji: '' };

    const presence = member.presence;
    if (!presence) return { text: 'OFFLINE', emoji: '' };

    switch (presence.status) {
      case 'online': return { text: 'ONLINE', emoji: '<:dark4luvontop:1533860081916182721>' };
      case 'idle': return { text: 'IDLE', emoji: 'ðŸŸ¡' };
      case 'dnd': return { text: 'DO NOT DISTURB', emoji: '' };
      case 'offline': return { text: 'OFFLINE', emoji: '' };
      default: return { text: 'UNKNOWN', emoji: '' };
    }
  } catch {
    return { text: 'UNKNOWN', emoji: '' };
  }
}

export async function applyAutonick(member, autonickConfig) {
  if (!autonickConfig || !autonickConfig.enabled) return false;
  if (!member.manageable) return false;

  let layout = autonickConfig.layout || '{name}';
  
  // Backwards compatibility
  if (layout === '{name}' && (autonickConfig.prefix || autonickConfig.suffix)) {
    layout = `${autonickConfig.prefix || ''}{name}${autonickConfig.suffix || ''}`;
  }

  const baseName = member.user.globalName || member.user.username;
  const layoutLenWithoutName = layout.length - '{name}'.length;
  const maxNameLen = Math.max(1, 32 - layoutLenWithoutName);
  
  let finalName = baseName;
  if (finalName.length > maxNameLen) {
    finalName = finalName.substring(0, maxNameLen);
  }
  
  const targetNick = layout.replace('{name}', finalName).substring(0, 32);
  
  if (member.displayName === targetNick || member.nickname === targetNick) return false;
  
  try {
    await member.setNickname(targetNick, 'Autonick Format');
    return true;
  } catch (e) {
    return false;
  }
}

