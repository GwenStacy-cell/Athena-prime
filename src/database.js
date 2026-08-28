import fs from 'fs';
import path from 'path';

const DB_DIR = path.resolve('data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure database directory and file exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DEFAULT_SCHEMA = {
  guilds: {},        // guildId -> config
  afk: {},           // userId -> { reason, timestamp }
  warnings: {},      // guildId -> { userId -> [...] }
  quarantines: {},   // guildId -> { userId -> { roles, quarantinedAt, reason, expiresAt } }
  extraOwners: {},   // guildId -> [ userId... ]
  spamPermitted: [], // global list
  backups: {},       // backupId -> backup data
  guildBackupMap: {},// guildId -> backupId (for overwrite detection)
  modModes: {},      // guildId -> { expiresAt, startedBy }
  triggers: {},      // guildId -> [ {match, response} ]
  jtc: {},           // guildId -> { lobbyChannelId, categoryId }
  jtcChannels: {},   // channelId -> { ownerId, guildId }
  botWhitelist: {},  // guildId -> [ botId... ]
  emergencies: {},   // guildId -> { roles: [{id, perms}], channels: [{id, overwrites}] }
  reactionRoles: {}, // messageId -> { guildId, channelId, title, mappings: [{emoji, roleId}] }
  serverStats: {},   // guildId -> { categoryId, totalId, humansId, botsId }
  birthdays: {},     // guildId -> { channelId, users: { userId -> { day, month } } }
  giveaways: {},     // messageId -> { guildId, channelId, hostId, prize, winnersCount, endsAt, participants: [] }
  newsFeeds: {},     // guildId -> { channelId, roleId, feeds: [{name, url}], lastGuids: [] }
  verification: {},  // guildId -> { roleId, messageId, channelId }
  tickets: {},       // guildId -> { categoryId, staffRoleIds: [], ticketCount: 0, activeTickets: {} } // ticketId -> { textId, voiceId, ownerId }
  xpSystems: {},     // guildId -> { enabled: false, announceChannelId: null, cmdChannelId: null, roleRewards: { level -> roleId }, multipliers: { roleId -> multiplier } }
  usersXp: {},       // guildId -> { userId -> { xp: 0, level: 0, lastMessageAt: 0, voiceJoinAt: 0 } }
  moveProtection: {},// guildId -> [userIds]
  botBlacklist: [],  // global list of userIds
  bumpReminders: {}, // guildId -> { channelId, bumperId, expiresAt }
  editRatings: {},   // messageId -> { authorId, authorName, mediaUrl, votes: {} }
  rateChannels: {},  // guildId -> channelId
  likedSongs: {},    // userId -> [ { title, url, duration, artworkUrl } ]
  bannedServers: [], // global list of banned guild IDs
  stickyMessages: {}, // guildId -> { channelId -> { content, lastMessageId, lastSentAt } }
  massRoles: {},      // guildId -> { roleId -> [userIds] }
  npManagers: [],     // global list of NP Manager user IDs
  npUsers: {},        // userId -> { expiresAt, appointedBy, addedAt }
  npServers: {},      // guildId -> { expiresAt, appointedBy, addedAt }
  npBannedUsers: [],  // global list of user IDs banned from NP
  npBannedCommands: [],// global list of command names banned from NP
  npPaused: false,    // boolean to pause entire NP system
  adelList: {},       // guildId -> { channelId -> [userId...] }
  botAnalytics: { joins: 0, leaves: 0, cmds: {} } // global stats tracking
};

class Database {
  constructor() {
    this.cache = DEFAULT_SCHEMA;
    this.saveTimeout = null;
    this.isSaving = false;
    this.needsSave = false;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        this.cache = JSON.parse(data);
        
        // Ensure standard structure is always present
        this.cache.guilds        = this.cache.guilds        || {};
        this.cache.afk           = this.cache.afk           || {};
        this.cache.warnings      = this.cache.warnings      || {};
        this.cache.quarantines   = this.cache.quarantines   || {};
        this.cache.extraOwners   = this.cache.extraOwners   || {};
        this.cache.spamPermitted = this.cache.spamPermitted || [];
        this.cache.backups        = this.cache.backups        || {};
        this.cache.guildBackupMap = this.cache.guildBackupMap || {};
        this.cache.modModes       = this.cache.modModes       || {};
        this.cache.triggers       = this.cache.triggers       || {};
        this.cache.jtc            = this.cache.jtc            || {};
        this.cache.botBlacklist   = this.cache.botBlacklist   || [];
        this.cache.jtcChannels    = this.cache.jtcChannels    || {};
        this.cache.botWhitelist   = this.cache.botWhitelist   || {};
        this.cache.emergencies    = this.cache.emergencies    || {};
        this.cache.reactionRoles  = this.cache.reactionRoles  || {};
        this.cache.serverStats    = this.cache.serverStats    || {};
        this.cache.birthdays      = this.cache.birthdays      || {};
          this.cache.afk = this.cache.afk || {};
        this.cache.giveaways      = this.cache.giveaways      || {};
        this.cache.newsFeeds      = this.cache.newsFeeds      || {};
        this.cache.verification   = this.cache.verification   || {};
        this.cache.tickets        = this.cache.tickets        || {};
        this.cache.xpSystems      = this.cache.xpSystems      || {};
        this.cache.usersXp        = this.cache.usersXp        || {};
        this.cache.moveProtection = this.cache.moveProtection || {};
        this.cache.editRatings    = this.cache.editRatings    || {};
        this.cache.rateChannels   = this.cache.rateChannels   || {};
        this.cache.massRoles      = this.cache.massRoles      || {};
        this.cache.npManagers     = this.cache.npManagers     || [];
        this.cache.npUsers        = this.cache.npUsers        || {};
        this.cache.npServers      = this.cache.npServers      || {};
        this.cache.npBannedUsers  = this.cache.npBannedUsers  || [];
        this.cache.npBannedCommands = this.cache.npBannedCommands || [];
        this.cache.npPaused       = this.cache.npPaused       || false;
        this.cache.adelList       = this.cache.adelList       || {};
        this.cache.botAnalytics   = this.cache.botAnalytics   || { joins: 0, leaves: 0, cmds: {} };
      } else {
        this.save();
      }
    } catch (error) {
      console.error('Error loading database:', error);
      this.cache = DEFAULT_SCHEMA;
    }
  }

  save() {
    this.needsSave = true;
    if (this.saveTimeout) return; // Debounce already in progress
    
    // Debounce the save by 1 second to batch multiple rapid changes
    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      if (this.isSaving) {
        // If a save is currently writing to disk, try again next tick
        this.save();
        return;
      }
      
      this.isSaving = true;
      this.needsSave = false;
      
      try {
        const replacer = (key, value) => {
          if (typeof value === 'bigint') return value.toString();
          // Skip circular Discord.js references if any sneak in
          if (value && typeof value === 'object' && value.client) return undefined;
          return value;
        };
        const dataStr = JSON.stringify(this.cache, replacer, 2);
        await fs.promises.writeFile(DB_FILE, dataStr, 'utf8');
      } catch (error) {
        console.error('Error saving database:', error);
      } finally {
        this.isSaving = false;
        if (this.needsSave) this.save(); // Process any changes that happened during the async write
      }
    }, 1000);
  }

  // Guild Configurations
  getGuildConfig(guildId) {
    if (!this.cache.guilds[guildId]) {
      this.cache.guilds[guildId] = {
        prefix: process.env.DEFAULT_PREFIX || '!',
        logChannel: null,
        voiceLogChannel: null,
        muteRoleId: null,
        quarantineRoleId: null,
        quarantineChannelId: null,
        quarantineVcId: null,
        homeVcId: null,
        inviteChannelId: null,
        linkBypassRole: null,
        inviteBypassRole: null,
        allowInvitesGlobally: false,
        antiSpamEnabled: true,
        antiSpamMentionEnabled: false,
        antiSpamMentionBypassRoles: [],
        antiLinkEnabled: false,
        antiInviteEnabled: true,
        raidMode: false,
          twoFactorEmail: null,
          twoFactorVerified: false,
          pendingTwoFactorCode: null,
        antiNukeEnabled: true,
        securityEnabled: false,
        antinukeModules: {
          antiRoleCreate: true,
          antiRoleDelete: true,
          antiRoleUpdate: true,
          antiRolePermUpdate: true,
          antiMemberRoleUpdate: true,
          antiRoleReorder: true,
          antiChannelCreate: true,
          antiChannelDelete: true,
          antiChannelUpdate: true,
          antiChannelPermUpdate: true,
          antiChannelReorder: true,
          antiChannelNameMod: true,
          antiEmojiCreate: true,
          antiEmojiDelete: true,
          antiEmojiUpdate: true,
          antiWebhooks: true,
          antiBotAdd: true,
          antiServerUpdate: true,
          antiBan: true,
          antiKick: true,
          antiUnban: true, // Replaced Invite with Unban in standard
          antiInvite: true,
          antiScheduledEvents: true,
          antiMemberPurge: true,
          antiMassBan: true,
          antiAutomodUpdate: true,
          antiAppCommands: true
        },
        antiNukePunishment: 'ban',
        antiNukeThreshold: 1,
        maxWarnings: 3,
        blacklistWords: [],
        whitelist: { users: {}, roles: {} },
        allowedLinks: [],
        accentColor: null,
        rrDmsEnabled: true,
        serverLogs: {
          enabled: false,
          defaultChannelId: null,
          categoryId: null,
          modules: {
            bans: { enabled: true, channelId: null },
            kicks: { enabled: true, channelId: null },
            leaves: { enabled: true, channelId: null },
            joins: { enabled: true, channelId: null },
            msgDeletes: { enabled: true, channelId: null },
            msgEdits: { enabled: true, channelId: null },
            channels: { enabled: true, channelId: null },
            roles: { enabled: true, channelId: null }
          }
        },
        autonick: {
          enabled: false,
          prefix: '',
          suffix: ''
        }
      };
      this.save();
    } else {
      // Self-heal/Backwards compatibility check for existing configs
      const cfg = this.cache.guilds[guildId];
      let updated = false;

      if (cfg.antiNukeEnabled === undefined) { cfg.antiNukeEnabled = true; updated = true; }
      if (cfg.securityEnabled === undefined) { cfg.securityEnabled = false; updated = true; }
      if (cfg.antinukeModules === undefined) {
        cfg.antinukeModules = {
          antiRoleCreate: true, antiRoleDelete: true, antiRoleUpdate: true, antiRolePermUpdate: true, antiMemberRoleUpdate: true, antiRoleReorder: true,
          antiChannelCreate: true, antiChannelDelete: true, antiChannelUpdate: true, antiChannelPermUpdate: true, antiChannelReorder: true, antiChannelNameMod: true,
          antiEmojiCreate: true, antiEmojiDelete: true, antiEmojiUpdate: true, antiWebhooks: true, antiBotAdd: true, antiServerUpdate: true,
          antiBan: true, antiKick: true, antiUnban: true, antiInvite: true, antiScheduledEvents: true, antiMemberPurge: true,
          antiMassBan: true, antiAutomodUpdate: true, antiAppCommands: true
        };
        updated = true;
      }
      if (cfg.maxWarnings === undefined) { cfg.maxWarnings = 3; updated = true; }
      if (cfg.blacklistWords === undefined) { cfg.blacklistWords = []; updated = true; }
      if (cfg.whitelist === undefined || Array.isArray(cfg.whitelist) || !cfg.whitelist.users) { 
        // Migrate old array format or old object format to granular object format
        const oldData = cfg.whitelist;
        cfg.whitelist = { users: {}, roles: {} }; 
        if (Array.isArray(oldData)) {
          oldData.forEach(id => {
            cfg.whitelist.users[id] = { modules: ['all'], triggerLimit: 0, currentUsage: 0 };
          });
        } else if (typeof oldData === 'object' && oldData !== null) {
          Object.keys(oldData).forEach(id => {
            // Keep old format if it was the string array type from the last update
            cfg.whitelist.users[id] = { modules: ['all'], triggerLimit: 0, currentUsage: 0 };
          });
        }
        updated = true; 
      }
      if (cfg.autonick === undefined) { cfg.autonick = { enabled: false, prefix: '', suffix: '', layout: '{name}' }; updated = true; }
      else if (cfg.autonick.layout === undefined) { cfg.autonick.layout = '{name}'; updated = true; }
      if (cfg.quarantineVcId === undefined) { cfg.quarantineVcId = null; updated = true; }
      if (cfg.homeVcId === undefined) { cfg.homeVcId = null; updated = true; }
      if (cfg.theaterModeVcId === undefined) { cfg.theaterModeVcId = null; updated = true; }
      if (cfg.inviteChannelId === undefined) { cfg.inviteChannelId = null; updated = true; }
      if (cfg.linkBypassRole === undefined) { cfg.linkBypassRole = null; updated = true; }
      if (cfg.inviteBypassRole === undefined) { cfg.inviteBypassRole = null; updated = true; }
      if (cfg.allowInvitesGlobally === undefined) { cfg.allowInvitesGlobally = false; updated = true; }
      if (cfg.antiNukePunishment === undefined) { cfg.antiNukePunishment = 'ban'; updated = true; }
      if (cfg.antiNukeThreshold === undefined) { cfg.antiNukeThreshold = 1; updated = true; }
      if (cfg.antiLinkEnabled === undefined) { cfg.antiLinkEnabled = false; updated = true; }
      if (cfg.antiSpamMentionEnabled === undefined) { cfg.antiSpamMentionEnabled = false; updated = true; }
      if (cfg.antiSpamMentionBypassRoles === undefined) { cfg.antiSpamMentionBypassRoles = []; updated = true; }
      if (cfg.antiInviteEnabled === undefined) { cfg.antiInviteEnabled = true; updated = true; }
      if (cfg.allowedLinks === undefined) { cfg.allowedLinks = []; updated = true; }
      if (cfg.accentColor === undefined) { cfg.accentColor = null; updated = true; }
      if (cfg.rrDmsEnabled === undefined) { cfg.rrDmsEnabled = true; updated = true; }
      if (cfg.serverLogs === undefined) { 
        cfg.serverLogs = {
          enabled: false,
          defaultChannelId: null,
          categoryId: null,
          modules: {
            bans: { enabled: true, channelId: null },
            kicks: { enabled: true, channelId: null },
            leaves: { enabled: true, channelId: null },
            joins: { enabled: true, channelId: null },
            msgDeletes: { enabled: true, channelId: null },
            msgEdits: { enabled: true, channelId: null },
            channels: { enabled: true, channelId: null },
            roles: { enabled: true, channelId: null }
          }
        }; 
        updated = true; 
      }
      if (cfg.musicChannelId === undefined) { cfg.musicChannelId = null; updated = true; }
      if (cfg.musicMessageId === undefined) { cfg.musicMessageId = null; updated = true; }
      if (cfg.musicCoverImage === undefined) { cfg.musicCoverImage = null; updated = true; }
      if (cfg.youtubeNotifiers === undefined) { cfg.youtubeNotifiers = []; updated = true; }
      if (cfg.autoroleIds === undefined) { 
        cfg.autoroleIds = []; 
        if (cfg.autoroleId) {
          cfg.autoroleIds.push(cfg.autoroleId);
          delete cfg.autoroleId;
        }
        updated = true; 
      }

      if (updated) this.save();
    }
    return this.cache.guilds[guildId];
  }

  updateGuildConfig(guildId, updates) {
    const config = this.getGuildConfig(guildId);
    Object.assign(config, updates);
    this.save();
    return config;
  }

  // Reaction Roles
  getReactionRoleMenu(messageId) {
    return this.cache.reactionRoles[messageId];
  }

  saveReactionRoleMenu(messageId, data) {
    this.cache.reactionRoles[messageId] = data;
    this.save();
  }

  deleteReactionRoleMenu(messageId) {
    if (this.cache.reactionRoles[messageId]) {
      delete this.cache.reactionRoles[messageId];
      this.save();
    }
  }

  // -------------------------
  // News Feeds Configuration
  // -------------------------
  getNewsConfig(guildId) {
    if (!this.cache.newsFeeds[guildId]) {
      this.cache.newsFeeds[guildId] = { channelId: null, roleId: null, feeds: [], lastGuids: [] };
      this.save();
    }
    return this.cache.newsFeeds[guildId];
  }

  setNewsSetup(guildId, channelId, roleId) {
    const cfg = this.getNewsConfig(guildId);
    cfg.channelId = channelId;
    cfg.roleId = roleId;
    this.save();
  }

  addNewsFeed(guildId, name, url) {
    const cfg = this.getNewsConfig(guildId);
    if (!cfg.feeds.find(f => f.url === url)) {
      cfg.feeds.push({ name, url });
      this.save();
      return true;
    }
    return false;
  }

  removeNewsFeed(guildId, url) {
    const cfg = this.getNewsConfig(guildId);
    const initialLen = cfg.feeds.length;
    cfg.feeds = cfg.feeds.filter(f => f.url !== url);
    if (cfg.feeds.length < initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  updateNewsGuids(guildId, guidsArray) {
    const cfg = this.getNewsConfig(guildId);
    // Keep only the last 200 guids to prevent infinite DB growth
    cfg.lastGuids = [...new Set([...guidsArray, ...cfg.lastGuids])].slice(0, 200);
    this.save();
  }

  // -------------------------
  // Server Stats
  // -------------------------
  getServerStats(guildId) {
    return this.cache.serverStats[guildId] || null;
  }

  saveServerStats(guildId, data) {
    this.cache.serverStats[guildId] = data;
    this.save();
  }

  deleteServerStats(guildId) {
    if (this.cache.serverStats[guildId]) {
      delete this.cache.serverStats[guildId];
      this.save();
    }
  }

  // Whitelist Manager
  isWhitelisted(guild, memberOrId, eventType = 'all') {
    if (!guild || !memberOrId) return false;
    const userId = typeof memberOrId === 'string' ? memberOrId : memberOrId.id;
    if (userId === guild.ownerId) return true; // Owner is always immune/whitelisted
    
    // Bot owner is ALWAYS whitelisted/immune
    const ownerIdEnv = process.env.OWNER_ID;
    if (ownerIdEnv && userId === ownerIdEnv) return true;
    
    // Extra owners are always whitelisted/immune
    if (this.isExtraOwner(guild.id, userId)) return true;

    const config = this.getGuildConfig(guild.id);
    if (!config.whitelist) return false;
    if (!config.securityEnabled && !config.antiNukeEnabled) return true; // If security is globally disabled, everyone is effectively whitelisted/allowed

    let wData = null;
    let isUserWhitelist = false;
    let targetId = null;
    let typeStr = null;

    if (config.whitelist.users && config.whitelist.users[userId]) {
      const uData = config.whitelist.users[userId];
      if (uData.modules.includes('all') || uData.modules.includes(eventType)) {
        wData = uData;
        isUserWhitelist = true;
        targetId = userId;
        typeStr = 'users';
      }
    }

    if (!wData && typeof memberOrId === 'object' && memberOrId.roles && config.whitelist.roles) {
      for (const [roleId, rData] of Object.entries(config.whitelist.roles)) {
        if (memberOrId.roles.cache.has(roleId)) {
          if (rData.modules.includes('all') || rData.modules.includes(eventType)) {
            wData = rData;
            targetId = roleId;
            typeStr = 'roles';
            break;
          }
        }
      }
    }

    if (!wData) return false;

    // Trigger limit check (0 means infinite)
    if (wData.triggerLimit > 0) {
      if (wData.currentUsage >= wData.triggerLimit) {
        // Limit exceeded, delete entry
        delete config.whitelist[typeStr][targetId];
        this.updateGuildConfig(guild.id, { whitelist: config.whitelist });
        return false;
      }
      
      // Valid action, increment usage
      wData.currentUsage++;
      this.updateGuildConfig(guild.id, { whitelist: config.whitelist });
    }
    return true;
  }

  getWhitelist(guildId, targetId, type = 'users') {
    const config = this.getGuildConfig(guildId);
    if (!config.whitelist || !config.whitelist[type]) return null;
    return config.whitelist[type][targetId] || null;
  }

  getAllWhitelists(guildId) {
    const config = this.getGuildConfig(guildId);
    if (!config.whitelist) return { users: {}, roles: {} };
    return {
      users: config.whitelist.users || {},
      roles: config.whitelist.roles || {}
    };
  }

  updateWhitelist(guildId, targetId, type, data) {
    // type is 'users' or 'roles'
    const config = this.getGuildConfig(guildId);
    if (!config.whitelist) config.whitelist = { users: {}, roles: {} };
    if (!config.whitelist[type]) config.whitelist[type] = {};
    
    if (data === null) {
      delete config.whitelist[type][targetId];
    } else {
      config.whitelist[type][targetId] = data;
    }
    
    this.updateGuildConfig(guildId, { whitelist: config.whitelist });
    return true;
  }

  // Blacklist Words Manager
  addBlacklistWord(guildId, word) {
    const config = this.getGuildConfig(guildId);
    const cleanWord = word.trim().toLowerCase();
    if (!config.blacklistWords.includes(cleanWord)) {
      config.blacklistWords.push(cleanWord);
      this.updateGuildConfig(guildId, { blacklistWords: config.blacklistWords });
      return true;
    }
    return false;
  }

  removeBlacklistWord(guildId, word) {
    const config = this.getGuildConfig(guildId);
    const cleanWord = word.trim().toLowerCase();
    const index = config.blacklistWords.indexOf(cleanWord);
    if (index !== -1) {
      config.blacklistWords.splice(index, 1);
      this.updateGuildConfig(guildId, { blacklistWords: config.blacklistWords });
      return true;
    }
    return false;
  }

  // Extra Owners Manager
  getExtraOwners(guildId) {
    if (!this.cache.extraOwners[guildId]) {
      this.cache.extraOwners[guildId] = [];
    }
    return this.cache.extraOwners[guildId];
  }

  isExtraOwner(guildId, userId) {
    if (!this.cache.extraOwners[guildId]) return false;
    return this.cache.extraOwners[guildId].includes(userId);
  }

  addExtraOwner(guildId, userId) {
    if (!this.cache.extraOwners[guildId]) {
      this.cache.extraOwners[guildId] = [];
    }
    if (!this.cache.extraOwners[guildId].includes(userId)) {
      this.cache.extraOwners[guildId].push(userId);
      this.save();
      return true;
    }
    return false;
  }

  removeExtraOwner(guildId, userId) {
    if (!this.cache.extraOwners[guildId]) return false;
    const index = this.cache.extraOwners[guildId].indexOf(userId);
    if (index !== -1) {
      this.cache.extraOwners[guildId].splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Warning System
  getWarnings(guildId, userId) {
    if (!this.cache.warnings[guildId]) {
      this.cache.warnings[guildId] = {};
    }
    return this.cache.warnings[guildId][userId] || [];
  }

  addWarning(guildId, userId, warnerId, reason) {
    if (!this.cache.warnings[guildId]) {
      this.cache.warnings[guildId] = {};
    }
    if (!this.cache.warnings[guildId][userId]) {
      this.cache.warnings[guildId][userId] = [];
    }

    const warning = {
      warnerId,
      reason,
      timestamp: Date.now()
    };

    this.cache.warnings[guildId][userId].push(warning);
    this.save();
    return this.cache.warnings[guildId][userId];
  }

  clearWarnings(guildId, userId) {
    if (this.cache.warnings[guildId] && this.cache.warnings[guildId][userId]) {
      this.cache.warnings[guildId][userId] = [];
      this.save();
      return true;
    }
    return false;
  }

  // Quarantine System
  getQuarantine(guildId, userId) {
    if (!this.cache.quarantines[guildId]) {
      return null;
    }
    return this.cache.quarantines[guildId][userId] || null;
  }

  addQuarantine(guildId, userId, roles, reason, previousVoiceChannelId = null, expiresAt = null) {
    if (!this.cache.quarantines[guildId]) {
      this.cache.quarantines[guildId] = {};
    }
    this.cache.quarantines[guildId][userId] = {
      roles,
      quarantinedAt: Date.now(),
      reason,
      previousVoiceChannelId,
      expiresAt   // null = permanent, timestamp = auto-unquarantine at this time
    };
    this.save();
  }

  removeQuarantine(guildId, userId) {
    if (this.cache.quarantines[guildId] && this.cache.quarantines[guildId][userId]) {
      const data = this.cache.quarantines[guildId][userId];
      delete this.cache.quarantines[guildId][userId];
      this.save();
      return data;
    }
    return null;
  }

  // Returns flat array of { guildId, userId, ...record } for all quarantined users
  getAllQuarantinedUsers() {
    const results = [];
    for (const [guildId, users] of Object.entries(this.cache.quarantines || {})) {
      for (const [userId, record] of Object.entries(users || {})) {
        results.push({ guildId, userId, ...record });
      }
    }
    return results;
  }

  getQuarantinedInGuild(guildId) {
    const guild = this.cache.quarantines?.[guildId] || {};
    return Object.entries(guild).map(([userId, record]) => ({ userId, ...record }));
  }

  // ==========================================
  // SPAM PERMIT SYSTEM (Global)
  // ==========================================

  addSpamPermit(userId) {
    this.cache.spamPermitted = this.cache.spamPermitted || [];
    if (!this.cache.spamPermitted.includes(userId)) {
      this.cache.spamPermitted.push(userId);
      this.save();
      return true;
    }
    return false; // already permitted
  }

  removeSpamPermit(userId) {
    this.cache.spamPermitted = this.cache.spamPermitted || [];
    const idx = this.cache.spamPermitted.indexOf(userId);
    if (idx !== -1) {
      this.cache.spamPermitted.splice(idx, 1);
      this.save();
      return true;
    }
    return false; // not found
  }

  isSpamPermitted(userId) {
    this.cache.spamPermitted = this.cache.spamPermitted || [];
    return this.cache.spamPermitted.includes(userId);
  }

  getSpamPermitted() {
    return this.cache.spamPermitted || [];
  }

  // ==========================================
  // ALLOWED LINKS SYSTEM (per guild)
  // Domains that bypass the anti-link filter
  // ==========================================

  addAllowedLink(guildId, domain) {
    const config = this.getGuildConfig(guildId);
    const clean = domain.trim().toLowerCase();
    if (!config.allowedLinks) config.allowedLinks = [];
    if (!config.allowedLinks.includes(clean)) {
      config.allowedLinks.push(clean);
      this.updateGuildConfig(guildId, { allowedLinks: config.allowedLinks });
      return true;
    }
    return false;
  }

  removeAllowedLink(guildId, domain) {
    const config = this.getGuildConfig(guildId);
    const clean = domain.trim().toLowerCase();
    if (!config.allowedLinks) return false;
    const idx = config.allowedLinks.indexOf(clean);
    if (idx !== -1) {
      config.allowedLinks.splice(idx, 1);
      this.updateGuildConfig(guildId, { allowedLinks: config.allowedLinks });
      return true;
    }
    return false;
  }

  getAllowedLinks(guildId) {
    const config = this.getGuildConfig(guildId);
    return config.allowedLinks || [];
  }

  // ==========================================
  // SERVER BACKUP SYSTEM
  // ==========================================

  saveBackup(backupId, data) {
    // If guild already has a backup, delete old one first
    const oldId = this.cache.guildBackupMap[data.guildId];
    if (oldId && oldId !== backupId) {
      delete this.cache.backups[oldId];
    }
    this.cache.backups[backupId] = data;
    this.cache.guildBackupMap[data.guildId] = backupId;
    this.save();
  }

  getBackup(backupId) {
    return this.cache.backups[backupId] || null;
  }

  getBackupByGuild(guildId) {
    const id = this.cache.guildBackupMap[guildId];
    return id ? this.cache.backups[id] : null;
  }

  deleteBackup(backupId) {
    const backup = this.cache.backups[backupId];
    if (backup) {
      delete this.cache.guildBackupMap[backup.guildId];
      delete this.cache.backups[backupId];
      this.save();
      return true;
    }
    return false;
  }

  getAllBackups() {
    return Object.entries(this.cache.backups || {}).map(([id, data]) => ({ id, ...data }));
  }

  // ==========================================
  // MODIFICATION MODE
  // ==========================================

  setModMode(guildId, expiresAt, startedBy) {
    this.cache.modModes = this.cache.modModes || {};
    this.cache.modModes[guildId] = { expiresAt, startedBy };
    this.save();
  }

  getModMode(guildId) {
    return this.cache.modModes?.[guildId] || null;
  }

  clearModMode(guildId) {
    if (this.cache.modModes?.[guildId]) {
      delete this.cache.modModes[guildId];
      this.save();
    }
  }

  isModModeActive(guildId) {
    const mm = this.cache.modModes?.[guildId];
    if (!mm) return false;
    if (Date.now() > mm.expiresAt) {
      this.clearModMode(guildId);
      return false;
    }
    return true;
  }

  // ==========================================
  // TRIGGERS (Auto-Responder)
  // ==========================================

  getTriggers(guildId) {
    if (!this.cache.triggers) this.cache.triggers = {};
    return this.cache.triggers[guildId] || [];
  }

  addTrigger(guildId, match, response) {
    if (!this.cache.triggers) this.cache.triggers = {};
    if (!this.cache.triggers[guildId]) this.cache.triggers[guildId] = [];

    const exists = this.cache.triggers[guildId].find(t => t.match.toLowerCase() === match.toLowerCase());
    if (exists) return false;

    this.cache.triggers[guildId].push({ match, response });
    this.save();
    return true;
  }

  removeTrigger(guildId, match) {
    if (!this.cache.triggers) return false;
    if (!this.cache.triggers[guildId]) return false;

    const initialLength = this.cache.triggers[guildId].length;
    this.cache.triggers[guildId] = this.cache.triggers[guildId].filter(
      t => t.match.toLowerCase() !== match.toLowerCase()
    );

    if (this.cache.triggers[guildId].length !== initialLength) {
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // JOIN TO CREATE (JTC)
  // ==========================================

  getJtcConfig(guildId) {
    if (!this.cache.jtc) this.cache.jtc = {};
    return this.cache.jtc[guildId] || null;
  }

  setJtcConfig(guildId, lobbyChannelId, categoryId, panelChannelId = null) {
    if (!this.cache.jtc) this.cache.jtc = {};
    // Preserve existing panelMessageId if panel channel hasn't changed
    const existing = this.cache.jtc[guildId];
    const sameChannel = existing?.panelChannelId === panelChannelId;
    const panelMessageId = (sameChannel ? existing?.panelMessageId : null) || null;
    const secondaryLobbyChannelId = existing?.secondaryLobbyChannelId || null;
    this.cache.jtc[guildId] = { lobbyChannelId, categoryId, panelChannelId, panelMessageId, secondaryLobbyChannelId };
    this.save();
  }

  setPanelMessageId(guildId, messageId) {
    if (!this.cache.jtc?.[guildId]) return;
    this.cache.jtc[guildId].panelMessageId = messageId;
    this.cache.jtc[guildId].panelMessageId = messageId;
    this.save();
  }

  setSecondaryJtcConfig(guildId, secondaryLobbyChannelId) {
    if (!this.cache.jtc) this.cache.jtc = {};
    if (!this.cache.jtc[guildId]) {
      this.cache.jtc[guildId] = { lobbyChannelId: null, categoryId: null, panelChannelId: null, panelMessageId: null };
    }
    this.cache.jtc[guildId].secondaryLobbyChannelId = secondaryLobbyChannelId;
    this.save();
  }

  clearJtcConfig(guildId) {
    if (!this.cache.jtc) return;
    delete this.cache.jtc[guildId];
    this.save();
  }

  // Active temp channels
  getJtcChannel(channelId) {
    if (!this.cache.jtcChannels) this.cache.jtcChannels = {};
    return this.cache.jtcChannels[channelId] || null;
  }

  addJtcChannel(channelId, ownerId, guildId) {
    if (!this.cache.jtcChannels) this.cache.jtcChannels = {};
    this.cache.jtcChannels[channelId] = { ownerId, guildId };
    this.save();
  }

  removeJtcChannel(channelId) {
    if (!this.cache.jtcChannels) return;
    delete this.cache.jtcChannels[channelId];
    this.save();
  }

  setJtcOwner(channelId, ownerId) {
    if (!this.cache.jtcChannels?.[channelId]) return;
    this.cache.jtcChannels[channelId].ownerId = ownerId;
    this.save();
  }

  setJtcTextChannel(channelId, textChannelId) {
    if (!this.cache.jtcChannels?.[channelId]) return;
    this.cache.jtcChannels[channelId].textChannelId = textChannelId;
    this.save();
  }

  isJtcChannel(channelId) {
    return !!(this.cache.jtcChannels?.[channelId]);
  }

  getAllJtcChannels() {
    if (!this.cache.jtcChannels) return [];
    return Object.entries(this.cache.jtcChannels).map(([channelId, data]) => ({ channelId, ...data }));
  }

  // ==========================================
  // WELCOME / LEAVE CONFIG
  // ==========================================
  getWelcomeConfig(guildId) {
    return this.cache.welcome?.[guildId] || null;
  }

  setWelcomeConfig(guildId, config) {
    if (!this.cache.welcome) this.cache.welcome = {};
    this.cache.welcome[guildId] = config;
    this.save();
  }

  getLeaveConfig(guildId) {
    return this.cache.leave?.[guildId] || null;
  }

  setLeaveConfig(guildId, config) {
    if (!this.cache.leave) this.cache.leave = {};
    this.cache.leave[guildId] = config;
    this.save();
  }

  // ==========================================
  // BOT WHITELIST (per-guild trusted bots)
  // ==========================================
  getBotWhitelist(guildId) {
    if (!this.cache.botWhitelist) this.cache.botWhitelist = {};
    return this.cache.botWhitelist[guildId] || [];
  }

  addBotToWhitelist(guildId, botId) {
    if (!this.cache.botWhitelist) this.cache.botWhitelist = {};
    if (!this.cache.botWhitelist[guildId]) this.cache.botWhitelist[guildId] = [];
    if (!this.cache.botWhitelist[guildId].includes(botId)) {
      this.cache.botWhitelist[guildId].push(botId);
      this.save();
    }
  }

  removeBotFromWhitelist(guildId, botId) {
    if (!this.cache.botWhitelist[guildId]) return;
    this.cache.botWhitelist[guildId] = this.cache.botWhitelist[guildId].filter(id => id !== botId);
    this.save();
  }

  // Emergency State
  getEmergencyState(guildId) {
    return this.cache.emergencies[guildId] || null;
  }

  saveEmergencyState(guildId, state) {
    this.cache.emergencies[guildId] = state;
    this.save();
  }

  clearEmergencyState(guildId) {
    if (this.cache.emergencies[guildId]) {
      delete this.cache.emergencies[guildId];
      this.save();
    }
  }

  isBotWhitelisted(guildId, botId) {
    return (this.cache.botWhitelist?.[guildId] || []).includes(botId);
  }

  // ==========================================
  // BIRTHDAY WISHING SYSTEM
  // ==========================================
  getBirthdayConfig(guildId) {
    if (!this.cache.birthdays) this.cache.birthdays = {};
    if (!this.cache.birthdays[guildId]) {
      this.cache.birthdays[guildId] = { channelId: null, users: {} };
      this.save();
    }
    return this.cache.birthdays[guildId];
  }

  setBirthdayChannel(guildId, channelId) {
    const config = this.getBirthdayConfig(guildId);
    config.channelId = channelId;
    this.save();
  }

  setWelcomeChannel(guildId, channelId) {
    this.getGuildConfig(guildId);
    this.cache.guilds[guildId].welcomeChannel = channelId;
    this.save();
  }

  setStatsChannel(guildId, channelId) {
    this.getGuildConfig(guildId);
    this.cache.guilds[guildId].statsChannelId = channelId;
    this.save();
  }

  setDashboardInfo(guildId, channelId, messageIds = []) {
    this.getGuildConfig(guildId);
    this.cache.guilds[guildId].dashboardChannelId = channelId;
    this.cache.guilds[guildId].dashboardMessageIds = messageIds;
    this.save();
  }

  setBirthday(guildId, userId, day, month) {
    const config = this.getBirthdayConfig(guildId);
    if (!config.users) config.users = {};
    config.users[userId] = { day, month };
    this.save();
  }

  removeBirthday(guildId, userId) {
    const config = this.getBirthdayConfig(guildId);
    if (config.users && config.users[userId]) {
      delete config.users[userId];
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // TICKET SYSTEM
  // ==========================================
  getTickets(guildId) {
    if (!this.cache.tickets[guildId]) {
      this.cache.tickets[guildId] = {
        categoryId: null,
        staffRoleIds: [],
        ticketCount: 0,
        activeTickets: {},
        panelMessageId: null,
        panelChannelId: null,
        panelTitle: 'Support Tickets',
        panelDescription: 'Need help? Select an option from the dropdown below to open a private ticket.',
        panelImage: null,
        panelThumbnail: null,
        panelPlaceholder: 'Select a reason...',
        panelOptions: [] // { label, description, emoji, value }
      };
      this.save();
    }
    return this.cache.tickets[guildId];
  }

  updateTicketConfig(guildId, updates) {
    const config = this.getTickets(guildId);
    Object.assign(config, updates);
    this.save();
    return config;
  }

  createTicket(guildId, textId, voiceId, ownerId) {
    const config = this.getTickets(guildId);
    config.ticketCount = (config.ticketCount || 0) + 1;
    const ticketId = config.ticketCount.toString().padStart(4, '0');
    
    config.activeTickets[ticketId] = {
      textId,
      voiceId,
      ownerId,
      createdAt: Date.now()
    };
    
    this.save();
    return ticketId;
  }

  closeTicket(guildId, ticketId) {
    const config = this.getTickets(guildId);
    if (config.activeTickets && config.activeTickets[ticketId]) {
      const ticketData = config.activeTickets[ticketId];
      delete config.activeTickets[ticketId];
      this.save();
      return ticketData;
    }
    return null;
  }

  // ==========================================
  // GIVEAWAY SYSTEM
  // ==========================================

  // Verification System
  getVerification(guildId) {
    if (!this.cache.verification) this.cache.verification = {};
    return this.cache.verification[guildId] || {};
  }

  updateVerification(guildId, data) {
    if (!this.cache.verification) this.cache.verification = {};
    this.cache.verification[guildId] = data;
    this.save();
  }

  deleteVerification(guildId) {
    if (!this.cache.verification) return;
    delete this.cache.verification[guildId];
    this.save();
  }

  getGiveaway(messageId) {
    if (!this.cache.giveaways) this.cache.giveaways = {};
    return this.cache.giveaways[messageId] || null;
  }

  saveGiveaway(messageId, data) {
    if (!this.cache.giveaways) this.cache.giveaways = {};
    this.cache.giveaways[messageId] = data;
    this.save();
  }

  removeGiveaway(messageId) {
    if (!this.cache.giveaways) return;
    if (this.cache.giveaways[messageId]) {
      delete this.cache.giveaways[messageId];
      this.save();
    }
  }

  addGiveawayParticipant(messageId, userId) {
    const gw = this.getGiveaway(messageId);
    if (!gw) return false;
    
    if (!gw.participants.includes(userId)) {
      gw.participants.push(userId);
      this.save();
      return true; // Joined
    } else {
      // User is already in it, remove them (toggle functionality)
      gw.participants = gw.participants.filter(id => id !== userId);
      this.save();
      return false; // Left
    }
  }

  getActiveGiveaways() {
    if (!this.cache.giveaways) return [];
    return Object.entries(this.cache.giveaways).map(([messageId, data]) => ({ messageId, ...data }));
  }
  // --------------------------------------------------------------------------
  // XP & Leveling System
  // --------------------------------------------------------------------------

  getXpSystem(guildId) {
    if (!this.cache.xpSystems[guildId]) {
      this.cache.xpSystems[guildId] = {
        enabled: false,
        announceChannelId: null,
        cmdChannelId: null,
        roleRewards: {}, // level (string) -> roleId
        multipliers: {}  // roleId -> multiplier (number)
      };
      this.save();
    }
    return this.cache.xpSystems[guildId];
  }

  setXpSystem(guildId, data) {
    this.cache.xpSystems[guildId] = data;
    this.save();
  }

  getUserXp(guildId, userId) {
    if (!this.cache.usersXp[guildId]) {
      this.cache.usersXp[guildId] = {};
    }
    if (!this.cache.usersXp[guildId][userId]) {
      this.cache.usersXp[guildId][userId] = {
        xp: 0,
        level: 0,
        lastMessageAt: 0,
        voiceJoinAt: 0
      };
      this.save();
    }
    return this.cache.usersXp[guildId][userId];
  }

  setUserXp(guildId, userId, data) {
    if (!this.cache.usersXp[guildId]) {
      this.cache.usersXp[guildId] = {};
    }
    this.cache.usersXp[guildId][userId] = data;
    this.save();
  }

  getTopUsersXp(guildId, limit = 10) {
    if (!this.cache.usersXp[guildId]) return [];
    
    return Object.entries(this.cache.usersXp[guildId])
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // Move Protection System
  // --------------------------------------------------------------------------
  getMoveProtectedUsers(guildId) {
    if (!this.cache.moveProtection[guildId]) {
      this.cache.moveProtection[guildId] = [];
      this.save();
    }
    return this.cache.moveProtection[guildId];
  }

  isMoveProtected(guildId, userId) {
    const protectedUsers = this.getMoveProtectedUsers(guildId);
    return protectedUsers.includes(userId);
  }

  addMoveProtectedUser(guildId, userId) {
    const protectedUsers = this.getMoveProtectedUsers(guildId);
    if (!protectedUsers.includes(userId)) {
      protectedUsers.push(userId);
      this.save();
      return true;
    }
    return false;
  }

  removeMoveProtectedUser(guildId, userId) {
    let protectedUsers = this.getMoveProtectedUsers(guildId);
    const initialLen = protectedUsers.length;
    this.cache.moveProtection[guildId] = protectedUsers.filter(id => id !== userId);
    if (this.cache.moveProtection[guildId].length < initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // VC Protection System (Mute/Deafen)
  // --------------------------------------------------------------------------
  getVcProtectedUsers(guildId) {
    if (!this.cache.vcProtection) this.cache.vcProtection = {};
    if (!this.cache.vcProtection[guildId]) {
      this.cache.vcProtection[guildId] = [];
      this.save();
    }
    return this.cache.vcProtection[guildId];
  }

  isVcProtected(guildId, userId) {
    const protectedUsers = this.getVcProtectedUsers(guildId);
    return protectedUsers.includes(userId);
  }

  addVcProtectedUser(guildId, userId) {
    const protectedUsers = this.getVcProtectedUsers(guildId);
    if (!protectedUsers.includes(userId)) {
      protectedUsers.push(userId);
      this.save();
      return true;
    }
    return false;
  }

  removeVcProtectedUser(guildId, userId) {
    let protectedUsers = this.getVcProtectedUsers(guildId);
    const initialLen = protectedUsers.length;
    this.cache.vcProtection[guildId] = protectedUsers.filter(id => id !== userId);
    if (this.cache.vcProtection[guildId].length < initialLen) {
      this.save();
      return true;
    }
    return false;
  }
  // Global Bot Blacklist (Flags)
  getBotBlacklist() {
    return this.cache.botBlacklist || [];
  }

  isUserBotBlacklisted(userId) {
    if (!this.cache.botBlacklist) this.cache.botBlacklist = [];
    return this.cache.botBlacklist.includes(userId);
  }

  addUserToBotBlacklist(userId) {
    if (!this.cache.botBlacklist) this.cache.botBlacklist = [];
    if (!this.cache.botBlacklist.includes(userId)) {
      this.cache.botBlacklist.push(userId);
      this.save();
      return true;
    }
    return false;
  }

  removeUserFromBotBlacklist(userId) {
    if (!this.cache.botBlacklist) this.cache.botBlacklist = [];
    const initialLen = this.cache.botBlacklist.length;
    this.cache.botBlacklist = this.cache.botBlacklist.filter(id => id !== userId);
    if (this.cache.botBlacklist.length < initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Bump Reminders ---
  getBumpReminders() {
    if (!this.cache.bumpReminders) this.cache.bumpReminders = {};
    return this.cache.bumpReminders;
  }

  setBumpReminder(guildId, data) {
    if (!this.cache.bumpReminders) this.cache.bumpReminders = {};
    this.cache.bumpReminders[guildId] = data;
    this.save();
  }

  deleteBumpReminder(guildId) {
    if (!this.cache.bumpReminders) this.cache.bumpReminders = {};
    if (this.cache.bumpReminders[guildId]) {
      delete this.cache.bumpReminders[guildId];
      this.save();
    }
  }
  // --- Edit Ratings ---
  getEditRating(messageId) {
    if (!this.cache.editRatings) this.cache.editRatings = {};
    return this.cache.editRatings[messageId];
  }

  getAllEditRatings() {
    if (!this.cache.editRatings) this.cache.editRatings = {};
    return this.cache.editRatings;
  }

  createEditRating(messageId, data) {
    if (!this.cache.editRatings) this.cache.editRatings = {};
    this.cache.editRatings[messageId] = {
      authorId: data.authorId,
      authorName: data.authorName,
      mediaUrl: data.mediaUrl,
      votes: {}
    };
    this.save();
  }

  updateEditRating(messageId, userId, userName, starCount) {
    if (!this.cache.editRatings) this.cache.editRatings = {};
    if (this.cache.editRatings[messageId]) {
      this.cache.editRatings[messageId].votes[userId] = { stars: starCount, name: userName };
      this.save();
      return true;
    }
    return false;
  }

  deleteEditRating(messageId) {
    if (!this.cache.editRatings) this.cache.editRatings = {};
    if (this.cache.editRatings[messageId]) {
      delete this.cache.editRatings[messageId];
      this.save();
    }
  }

  // --- Rate Channels ---
  getRateChannel(guildId) {
    if (!this.cache.rateChannels) this.cache.rateChannels = {};
    return this.cache.rateChannels[guildId] || null;
  }

  setRateChannel(guildId, channelId) {
    if (!this.cache.rateChannels) this.cache.rateChannels = {};
    this.cache.rateChannels[guildId] = channelId;
    this.save();
  }

  // --- Liked Songs ---
  getLikedSongs(userId) {
    if (!this.cache.likedSongs) this.cache.likedSongs = {};
    return this.cache.likedSongs[userId] || [];
  }

  toggleLikedSong(userId, song) {
    if (!this.cache.likedSongs) this.cache.likedSongs = {};
    if (!this.cache.likedSongs[userId]) this.cache.likedSongs[userId] = [];
    
    const idx = this.cache.likedSongs[userId].findIndex(s => s.url === song.url);
    let added = false;
    if (idx !== -1) {
      this.cache.likedSongs[userId].splice(idx, 1);
    } else {
      this.cache.likedSongs[userId].push({
         title: song.title,
         url: song.url,
         duration: song.duration,
         artworkUrl: song.artworkUrl,
         encoded: song.encoded
      });
      added = true;
    }
    this.save();
    return added;
  }

  // ==========================================
  // SERVER BANNING
  // ==========================================
  addBannedServer(guildId) {
    if (!this.cache.bannedServers) this.cache.bannedServers = [];
    if (!this.cache.bannedServers.includes(guildId)) {
      this.cache.bannedServers.push(guildId);
      this.save();
      return true;
    }
    return false;
  }

  removeBannedServer(guildId) {
    if (!this.cache.bannedServers) return false;
    const idx = this.cache.bannedServers.indexOf(guildId);
    if (idx > -1) {
      this.cache.bannedServers.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  isServerBanned(guildId) {
    if (!this.cache.bannedServers) return false;
    return this.cache.bannedServers.includes(guildId);
  }

  // --- STICKY MESSAGES ---
  
  getStickyMessage(guildId, channelId) {
    if (!this.cache.stickyMessages) this.cache.stickyMessages = {};
    if (!this.cache.stickyMessages[guildId]) return null;
    return this.cache.stickyMessages[guildId][channelId] || null;
  }

  setStickyMessage(guildId, channelId, content) {
    if (!this.cache.stickyMessages) this.cache.stickyMessages = {};
    if (!this.cache.stickyMessages[guildId]) {
      this.cache.stickyMessages[guildId] = {};
    }
    const existing = this.cache.stickyMessages[guildId][channelId] || {};
    this.cache.stickyMessages[guildId][channelId] = {
      content: content,
      footerText: existing.footerText || null,
      lastMessageId: existing.lastMessageId || null,
      lastSentAt: 0
    };
    this.save();
    return true;
  }

  setStickyFooter(guildId, channelId, footerText) {
    if (!this.cache.stickyMessages) return false;
    if (!this.cache.stickyMessages[guildId]) return false;
    if (this.cache.stickyMessages[guildId][channelId]) {
      this.cache.stickyMessages[guildId][channelId].footerText = footerText;
      this.cache.stickyMessages[guildId][channelId].lastSentAt = 0;
      this.save();
      return true;
    }
    return false;
  }

  removeStickyMessage(guildId, channelId) {
    if (!this.cache.stickyMessages) return false;
    if (!this.cache.stickyMessages[guildId]) return false;
    if (this.cache.stickyMessages[guildId][channelId]) {
      delete this.cache.stickyMessages[guildId][channelId];
      if (Object.keys(this.cache.stickyMessages[guildId]).length === 0) {
        delete this.cache.stickyMessages[guildId];
      }
      this.save();
      return true;
    }
    return false;
  }

  updateStickyMessageData(guildId, channelId, messageId, sentAt) {
    if (!this.cache.stickyMessages) return;
    if (!this.cache.stickyMessages[guildId]) return;
    if (this.cache.stickyMessages[guildId][channelId]) {
      this.cache.stickyMessages[guildId][channelId].lastMessageId = messageId;
      this.cache.stickyMessages[guildId][channelId].lastSentAt = sentAt;
      this.save();
    }
  }
  // --------------------------------------------------------------------------
  // AFK SYSTEM
  // --------------------------------------------------------------------------
  
  setAfk(userId, reason, timestamp) {
    this.cache.afk[userId] = { reason, timestamp };
    this.save();
  }

  getAfk(userId) {
    return this.cache.afk[userId] || null;
  }

  removeAfk(userId) {
    if (this.cache.afk[userId]) {
      delete this.cache.afk[userId];
      this.save();
      return true;
    }
    return false;
  }

  // --- YouTube Notifier Config ---
  getYouTubeNotifiers(guildId) {
    return this.getGuildConfig(guildId).youtubeNotifiers || [];
  }

  addYouTubeNotifier(guildId, data) {
    const config = this.getGuildConfig(guildId);
    if (!config.youtubeNotifiers) config.youtubeNotifiers = [];
    config.youtubeNotifiers.push(data);
    this.save();
  }

  removeYouTubeNotifier(guildId, youtubeId) {
    const config = this.getGuildConfig(guildId);
    if (!config.youtubeNotifiers) return false;
    const initialLen = config.youtubeNotifiers.length;
    config.youtubeNotifiers = config.youtubeNotifiers.filter(n => n.youtubeId !== youtubeId);
    if (config.youtubeNotifiers.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  updateYouTubeNotifier(guildId, youtubeId, discordChannelId, lastVideoId) {
    const config = this.getGuildConfig(guildId);
    if (!config.youtubeNotifiers) return;
    const notifier = config.youtubeNotifiers.find(n => n.youtubeId === youtubeId && n.discordChannelId === discordChannelId);
    if (notifier) {
      if (!notifier.recentVideoIds) {
        notifier.recentVideoIds = notifier.lastVideoId ? [notifier.lastVideoId] : [];
      }
      notifier.lastVideoId = lastVideoId;
      notifier.recentVideoIds.unshift(lastVideoId);
      // Keep only last 10
      if (notifier.recentVideoIds.length > 10) {
        notifier.recentVideoIds.pop();
      }
      this.save();
    }
  }
  // --- NP SYSTEM METHODS ---
  
  getNpManagers() {
    return this.cache.npManagers || [];
  }

  isNpManager(userId) {
    return (this.cache.npManagers || []).includes(userId);
  }

  addNpManager(userId) {
    if (!this.cache.npManagers) this.cache.npManagers = [];
    if (!this.cache.npManagers.includes(userId)) {
      this.cache.npManagers.push(userId);
      this.save();
    }
  }

  removeNpManager(userId) {
    if (this.cache.npManagers) {
      this.cache.npManagers = this.cache.npManagers.filter(id => id !== userId);
      this.save();
    }
  }

  getNpUser(userId) {
    const user = (this.cache.npUsers || {})[userId];
    if (user && user.expiresAt && Date.now() > user.expiresAt) {
      this.removeNpUser(userId);
      return null;
    }
    return user || null;
  }

  getAllNpUsers() {
    return this.cache.npUsers || {};
  }

  addNpUser(userId, expiresAt, appointedBy) {
    if (!this.cache.npUsers) this.cache.npUsers = {};
    this.cache.npUsers[userId] = {
      expiresAt: expiresAt,
      appointedBy: appointedBy,
      addedAt: Date.now()
    };
    this.save();
  }

  removeNpUser(userId) {
    if (this.cache.npUsers && this.cache.npUsers[userId]) {
      delete this.cache.npUsers[userId];
      this.save();
      return true;
    }
    return false;
  }

  getNpServer(guildId) {
    const server = (this.cache.npServers || {})[guildId];
    if (server && server.expiresAt && Date.now() > server.expiresAt) {
      this.removeNpServer(guildId);
      return null;
    }
    return server || null;
  }

  getAllNpServers() {
    return this.cache.npServers || {};
  }

  addNpServer(guildId, expiresAt, appointedBy) {
    if (!this.cache.npServers) this.cache.npServers = {};
    this.cache.npServers[guildId] = {
      expiresAt: expiresAt,
      appointedBy: appointedBy,
      addedAt: Date.now()
    };
    this.save();
  }

  removeNpServer(guildId) {
    if (this.cache.npServers && this.cache.npServers[guildId]) {
      delete this.cache.npServers[guildId];
      this.save();
      return true;
    }
    return false;
  }

  isNpPaused() {
    return !!this.cache.npPaused;
  }

  setNpPaused(paused) {
    this.cache.npPaused = paused;
    this.save();
  }

  getNpBannedCommands() {
    return this.cache.npBannedCommands || [];
  }

  banNpCommand(commandName) {
    if (!this.cache.npBannedCommands) this.cache.npBannedCommands = [];
    const name = commandName.toLowerCase();
    if (!this.cache.npBannedCommands.includes(name)) {
      this.cache.npBannedCommands.push(name);
      this.save();
      return true;
    }
    return false;
  }

  unbanNpCommand(commandName) {
    if (!this.cache.npBannedCommands) return false;
    const name = commandName.toLowerCase();
    const initialLen = this.cache.npBannedCommands.length;
    this.cache.npBannedCommands = this.cache.npBannedCommands.filter(c => c !== name);
    if (this.cache.npBannedCommands.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- ADEL (Auto-Delete) SYSTEM ---
  getAdelList(guildId, channelId) {
    if (!this.cache.adelList) this.cache.adelList = {};
    if (!this.cache.adelList[guildId]) return [];
    return this.cache.adelList[guildId][channelId] || [];
  }

  addAdel(guildId, channelId, userId) {
    if (!this.cache.adelList) this.cache.adelList = {};
    if (!this.cache.adelList[guildId]) this.cache.adelList[guildId] = {};
    if (!this.cache.adelList[guildId][channelId]) this.cache.adelList[guildId][channelId] = [];
    if (!this.cache.adelList[guildId][channelId].includes(userId)) {
      this.cache.adelList[guildId][channelId].push(userId);
      this.save();
      return true;
    }
    return false;
  }

  removeAdel(guildId, channelId, userId) {
    if (!this.cache.adelList) return false;
    if (!this.cache.adelList[guildId]) return false;
    if (!this.cache.adelList[guildId][channelId]) return false;
    const idx = this.cache.adelList[guildId][channelId].indexOf(userId);
    if (idx > -1) {
      this.cache.adelList[guildId][channelId].splice(idx, 1);
      if (this.cache.adelList[guildId][channelId].length === 0) {
        delete this.cache.adelList[guildId][channelId];
        if (Object.keys(this.cache.adelList[guildId]).length === 0) {
          delete this.cache.adelList[guildId];
        }
      }
      this.save();
      return true;
    }
    return false;
  }
}

const dbInstance = new Database();
export default dbInstance;
