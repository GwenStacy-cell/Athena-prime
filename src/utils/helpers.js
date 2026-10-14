import { PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../database.js';

// ==========================================
// ROLE AUTHORIZATION TIERS
// ==========================================
export function isServerAdmin(member, guildId) {
  if (!member) return false;
  const gid = (typeof guildId === 'object' && guildId !== null) ? guildId.id : (guildId || member.guild?.id);
  if (isBotOwnerOrServerOwnerStrict(member.id, member.guild)) return true;
  if (member.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;
  if (db.isExtraOwner(gid, member.id)) return true;
  
  const authRoles = db.getAuthRoles(gid);
  return authRoles.admin.some(roleId => member.roles.cache.has(roleId));
}

export function isServerMod(member, guildId) {
  if (isServerAdmin(member, guildId)) return true; // Higher tier inherits lower
  const gid = (typeof guildId === 'object' && guildId !== null) ? guildId.id : (guildId || member.guild?.id);
  const authRoles = db.getAuthRoles(gid);
  return authRoles.mod.some(roleId => member.roles.cache.has(roleId));
}

export function isServerStaff(member, guildId) {
  if (isServerMod(member, guildId)) return true; // Higher tier inherits lower
  const gid = (typeof guildId === 'object' && guildId !== null) ? guildId.id : (guildId || member.guild?.id);
  const authRoles = db.getAuthRoles(gid);
  return authRoles.staff.some(roleId => member.roles.cache.has(roleId));
}


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
const HARDCODED_OWNER_IDS = ['1423292960744804383', '1383136323183050974'];

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
          topic: 'Automated security audits and moderation records - Athena Prime',
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
      try {
        if (embedObject && embedObject.components) {
          await channel.send(embedObject);
        } else {
          await channel.send({ embeds: [embedObject] });
        }
      } catch (err) {
        if (err.code === 10003) {
          // Channel was deleted, remove from config
          db.updateGuildConfig(guild.id, { logChannel: null });
        }
      }
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

  // ALWAYS fetch ID from our database first to detect
  if (config.quarantineRoleId) {
    role = guild.roles.cache.get(config.quarantineRoleId) || await guild.roles.fetch(config.quarantineRoleId).catch(() => null);
  }

  if (!role) {
    role = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined');
    if (!role) {
      role = await guild.roles.create({
        name: 'Quarantined',
        color: '#ff0000',
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

  if (role && role.hexColor?.toLowerCase() !== '#ff0000') {
    await role.setColor('#ff0000').catch(() => null);
  }

  return role;
}

/**
 * Resolves or builds a single channel where quarantined members are restricted to talk and view
 */
export async function getOrCreateQuarantineChannel(guild, quarantineRole, parentCategory = null) {
  const config = db.getGuildConfig(guild.id);
  let channel = null;

  // ALWAYS fetch ID from our database first to detect
  if (config.quarantineChannelId) {
    channel = guild.channels.cache.get(config.quarantineChannelId) || await guild.channels.fetch(config.quarantineChannelId).catch(() => null);
  }

  if (!channel) {
    const catId = parentCategory?.id || config.quarantineCategoryId;
    if (catId) {
      channel = guild.channels.cache.find(c => 
        c.type === ChannelType.GuildText && 
        c.parentId === catId
      );
    }
    if (!channel) {
      channel = guild.channels.cache.find(c => 
        c.type === ChannelType.GuildText && 
        (c.name === 'you-have-been-quarantined' || c.name === 'quarantine-zone' || c.name.toLowerCase().includes('quarantine'))
      );
    }
    
    if (!channel) {
      channel = await guild.channels.create({
        name: 'you-have-been-quarantined',
        type: ChannelType.GuildText,
        parent: catId || undefined,
        topic: 'Restricted Access Area - You Have Been Quarantined - Athena Prime',
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
 * Resolves or builds a single voice channel for quarantine isolation
 */
export async function getOrCreateQuarantineVc(guild, quarantineRole, parentCategory = null) {
  const config = db.getGuildConfig(guild.id);
  let vc = null;

  // ALWAYS fetch ID from our database first to detect
  if (config.quarantineVcId) {
    vc = guild.channels.cache.get(config.quarantineVcId) || await guild.channels.fetch(config.quarantineVcId).catch(() => null);
  }

  if (!vc) {
    const catId = parentCategory?.id || config.quarantineCategoryId;
    if (catId) {
      vc = guild.channels.cache.find(c => 
        (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && 
        c.parentId === catId
      );
    }
    if (!vc) {
      vc = guild.channels.cache.find(c => 
        (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && 
        (c.name.toLowerCase().includes('you have been quarantined') || c.name.toLowerCase().includes('quarantine'))
      );
    }
    
    if (!vc) {
      vc = await guild.channels.create({
        name: 'You Have Been Quarantined',
        type: ChannelType.GuildVoice,
        parent: catId || undefined,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
          },
          {
            id: quarantineRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect
            ]
          }
        ],
        reason: 'Athena Prime automatic quarantine voice channel creation'
      }).catch(() => null);
    }

    if (vc) {
      db.updateGuildConfig(guild.id, { quarantineVcId: vc.id });
    }
  }

  return vc;
}

/**
 * Automated end-to-end setup of Quarantine Role, Isolation Category, Text Channel, and Voice Channel,
 * binding all IDs to database and syncing channel permissions.
 */
export async function autoSetupQuarantine(guild) {
  const config = db.getGuildConfig(guild.id);

  // 1. Quarantined Role Check: ALWAYS fetch ID from our database first
  let role = null;
  let roleInDb = false;
  let roleFound = false;

  if (config.quarantineRoleId) {
    role = guild.roles.cache.get(config.quarantineRoleId) || await guild.roles.fetch(config.quarantineRoleId).catch(() => null);
    if (role) {
      roleInDb = true;
      roleFound = true;
    }
  }

  // Fallback: search guild cache by name only if not found from database ID
  if (!role) {
    role = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined');
    if (role) {
      roleFound = true;
    }
  }

  if (role) {
    if (role.hexColor?.toLowerCase() !== '#ff0000') {
      await role.setColor('#ff0000').catch(() => null);
    }
  } else {
    role = await guild.roles.create({
      name: 'Quarantined',
      color: '#ff0000',
      colors: { primaryColor: '#ff0000' },
      hoist: true,
      reason: 'Athena Prime automatic quarantine role creation',
      permissions: [] // Zero global permissions
    }).catch(() => null);
  }
  if (!role) throw new Error('Could not create or locate the Quarantined role.');

  // 2. Quarantine Category Check: ALWAYS fetch ID from our database first
  const categoryTargetName = '.      You Have Been Quarantined';
  let category = null;
  let categoryInDb = false;
  let categoryFound = false;

  if (config.quarantineCategoryId) {
    category = guild.channels.cache.get(config.quarantineCategoryId) || await guild.channels.fetch(config.quarantineCategoryId).catch(() => null);
    if (category && category.type === ChannelType.GuildCategory) {
      categoryInDb = true;
      categoryFound = true;
    } else {
      category = null;
    }
  }

  // Fallback: search guild cache by name only if not found from database ID
  if (!category) {
    category = guild.channels.cache.find(c => 
      c.type === ChannelType.GuildCategory && 
      (c.name === categoryTargetName || c.name.toLowerCase().includes('you have been quarantined') || c.name.toLowerCase().includes('quarantine'))
    );
    if (category) {
      categoryFound = true;
    }
  }

  if (!category) {
    category = await guild.channels.create({
      name: categoryTargetName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: role.id,
          allow: [PermissionFlagsBits.ViewChannel]
        }
      ],
      reason: 'Athena Prime - quarantine isolation category auto-setup'
    }).catch(() => null);
  }

  // 3. Quarantine Text Channel Check: ALWAYS fetch ID from our database first
  let textChannel = null;
  let textInDb = false;
  let textFound = false;

  if (config.quarantineChannelId) {
    textChannel = guild.channels.cache.get(config.quarantineChannelId) || await guild.channels.fetch(config.quarantineChannelId).catch(() => null);
    if (textChannel && textChannel.type === ChannelType.GuildText) {
      textInDb = true;
      textFound = true;
    } else {
      textChannel = null;
    }
  }

  // Fallback: search under category or by name only if not found from database ID
  if (!textChannel && category) {
    textChannel = guild.channels.cache.find(c => 
      c.type === ChannelType.GuildText && 
      c.parentId === category.id
    );
  }
  if (!textChannel) {
    textChannel = guild.channels.cache.find(c => 
      c.type === ChannelType.GuildText && 
      (c.name === 'you-have-been-quarantined' || c.name === 'quarantine-zone' || c.name.toLowerCase().includes('quarantine'))
    );
  }

  if (textChannel) {
    textFound = true;
  } else {
    textChannel = await guild.channels.create({
      name: 'you-have-been-quarantined',
      type: ChannelType.GuildText,
      parent: category?.id || undefined,
      topic: 'Restricted Access Area - You Have Been Quarantined - Athena Prime',
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        },
        {
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ],
      reason: 'Athena Prime - quarantine text channel auto-setup'
    }).catch(() => null);
  }

  // 4. Quarantine Voice Channel (VC) Check: ALWAYS fetch ID from our database first
  let voiceChannel = null;
  let vcInDb = false;
  let vcFound = false;

  if (config.quarantineVcId) {
    voiceChannel = guild.channels.cache.get(config.quarantineVcId) || await guild.channels.fetch(config.quarantineVcId).catch(() => null);
    if (voiceChannel && (voiceChannel.type === ChannelType.GuildVoice || voiceChannel.type === ChannelType.GuildStageVoice)) {
      vcInDb = true;
      vcFound = true;
    } else {
      voiceChannel = null;
    }
  }

  // Fallback: search under category or by name only if not found from database ID
  if (!voiceChannel && category) {
    voiceChannel = guild.channels.cache.find(c => 
      (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && 
      c.parentId === category.id
    );
  }
  if (!voiceChannel) {
    voiceChannel = guild.channels.cache.find(c => 
      (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && 
      (c.name.toLowerCase().includes('you have been quarantined') || c.name.toLowerCase().includes('quarantine'))
    );
  }

  if (voiceChannel) {
    vcFound = true;
  } else {
    voiceChannel = await guild.channels.create({
      name: 'You Have Been Quarantined',
      type: ChannelType.GuildVoice,
      parent: category?.id || undefined,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
        },
        {
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect
          ]
        }
      ],
      reason: 'Athena Prime - quarantine voice channel auto-setup'
    }).catch(() => null);
  }

  // Check parent status BEFORE moving
  const textWasUnderCat = Boolean(category && textChannel && textChannel.parentId === category.id);
  const vcWasUnderCat = Boolean(category && voiceChannel && voiceChannel.parentId === category.id);

  // 5. ALWAYS update Database Configuration with all assigned IDs
  db.updateGuildConfig(guild.id, {
    quarantineRoleId: role.id,
    quarantineCategoryId: category?.id || null,
    quarantineChannelId: textChannel?.id || null,
    quarantineVcId: voiceChannel?.id || null
  });

  // 6. Ensure Quarantine Category Permissions & Assign/Sync Channels Under Category
  if (category) {
    // Toggle quarantine isolation overwrites on parent category
    await category.permissionOverwrites.set([
      {
        id: guild.roles.everyone.id,
        deny: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.Connect
        ]
      },
      {
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak
        ]
      }
    ], 'Athena Prime quarantine category isolation permissions').catch(() => null);

    // Assign text channel under category and sync permissions
    if (textChannel) {
      if (textChannel.parentId !== category.id) {
        await textChannel.setParent(category.id, { lockPermissions: true }).catch(() => null);
      }
      await textChannel.lockPermissions().catch(() => null);
    }

    // Assign voice channel under category and sync permissions
    if (voiceChannel) {
      if (voiceChannel.parentId !== category.id) {
        await voiceChannel.setParent(category.id, { lockPermissions: true }).catch(() => null);
      }
      await voiceChannel.lockPermissions().catch(() => null);
    }
  }

  // 7. Enforce Server-Wide Channel Sync (denies quarantineRole on all normal channels)
  const excludeIds = [textChannel?.id, voiceChannel?.id, category?.id].filter(Boolean);
  const synced = await syncQuarantinePermissions(guild, role, excludeIds);

  const allFound = (roleInDb && categoryInDb && textInDb && vcInDb && textWasUnderCat && vcWasUnderCat) ||
                   (roleFound && categoryFound && textFound && vcFound && textWasUnderCat && vcWasUnderCat);

  return {
    role,
    category,
    textChannel,
    voiceChannel,
    synced,
    allFound,
    roleFound,
    categoryFound,
    textFound,
    vcFound,
    textWasUnderCat,
    vcWasUnderCat,
    roleInDb,
    categoryInDb,
    textInDb,
    vcInDb
  };
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
 * STRICT version - only bot owner OR server owner. Extra owners are NOT included.
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
  const config = db.getGuildConfig(guild.id);
  const allowedChannelIds = new Set();
  if (excludeChannelId) {
    if (Array.isArray(excludeChannelId) || excludeChannelId instanceof Set) {
      excludeChannelId.forEach(id => { if (id) allowedChannelIds.add(id); });
    } else {
      allowedChannelIds.add(excludeChannelId);
    }
  }
  // ALWAYS fetch all quarantine zone IDs from database
  if (config.quarantineCategoryId) allowedChannelIds.add(config.quarantineCategoryId);
  if (config.quarantineVcId) allowedChannelIds.add(config.quarantineVcId);
  if (config.quarantineChannelId) allowedChannelIds.add(config.quarantineChannelId);

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
        // Quarantine zone channels - grant access
        if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
          await channel.permissionOverwrites.edit(quarantineRole, {
            ViewChannel:  true,
            Connect:      true,
            Speak:        true,
            SendMessages: false
          }, { reason: 'Athena Prime - quarantine VC access grant' });
        } else if (channel.type === ChannelType.GuildCategory) {
          await channel.permissionOverwrites.edit(quarantineRole, {
            ViewChannel:  true
          }, { reason: 'Athena Prime - quarantine category access grant' });
        } else {
          await channel.permissionOverwrites.edit(quarantineRole, {
            ViewChannel:      true,
            SendMessages:     true,
            ReadMessageHistory: true,
            Connect:          false
          }, { reason: 'Athena Prime - quarantine text access grant' });
        }
      } else {
        // All other channels - fully deny
        await channel.permissionOverwrites.edit(quarantineRole, {
          ViewChannel:  false,
          SendMessages: false,
          Connect:      false,
          Speak:        false
        }, { reason: 'Athena Prime - quarantine permission sync' });
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
      case 'online': return { text: 'ONLINE', emoji: '<a:uptime:1552608831060844575>' };
      case 'idle': return { text: 'IDLE', emoji: 'ðŸŸ¡' };
      case 'dnd': return { text: 'DO NOT DISTURB', emoji: '' };
      case 'offline': return { text: 'OFFLINE', emoji: '' };
      default: return { text: 'UNKNOWN', emoji: '' };
    }
  } catch {
    return { text: 'UNKNOWN', emoji: '' };
  }
}

export function formatNickname(layout, name) {
  if (!layout) layout = '{name}';
  const cleanName = (name || 'User').trim();
  if (/\{(name|user|username)\}/i.test(layout)) {
    return layout.replace(/\{(name|user|username)\}/gi, cleanName).substring(0, 32);
  }
  return `${layout} ${cleanName}`.trim().substring(0, 32);
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
  const targetNick = formatNickname(layout, baseName);
  
  if (member.displayName === targetNick || member.nickname === targetNick) return false;
  
  try {
    await member.setNickname(targetNick, 'Autonick Format');
    return true;
  } catch (e) {
    return false;
  }
}

