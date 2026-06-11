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
  botWhitelist: {}   // guildId -> [ botId... ]
};

class Database {
  constructor() {
    this.cache = DEFAULT_SCHEMA;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        this.cache = JSON.parse(data);
        
        // Ensure standard structure is always present
        this.cache.guilds        = this.cache.guilds        || {};
        this.cache.warnings      = this.cache.warnings      || {};
        this.cache.quarantines   = this.cache.quarantines   || {};
        this.cache.extraOwners   = this.cache.extraOwners   || {};
        this.cache.spamPermitted = this.cache.spamPermitted || [];
        this.cache.backups        = this.cache.backups        || {};
        this.cache.guildBackupMap = this.cache.guildBackupMap || {};
        this.cache.modModes       = this.cache.modModes       || {};
        this.cache.triggers       = this.cache.triggers       || {};
        this.cache.jtc            = this.cache.jtc            || {};
        this.cache.jtcChannels    = this.cache.jtcChannels    || {};
        this.cache.botWhitelist   = this.cache.botWhitelist   || {};
      } else {
        this.save();
      }
    } catch (error) {
      console.error('Error loading database:', error);
      this.cache = DEFAULT_SCHEMA;
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  // Guild Configurations
  getGuildConfig(guildId) {
    if (!this.cache.guilds[guildId]) {
      this.cache.guilds[guildId] = {
        prefix: process.env.DEFAULT_PREFIX || '!',
        logChannel: null,
        muteRoleId: null,
        quarantineRoleId: null,
        quarantineChannelId: null,
        quarantineVcId: null,
        homeVcId: null,
        antiSpamEnabled: true,
        antiLinkEnabled: false,
        antiInviteEnabled: true,
        raidMode: false,
        antiNukeEnabled: true,
        antiNukePunishment: 'ban', // default is 'ban'
        antiNukeThreshold: 1, // default is 1 action
        maxWarnings: 3,
        blacklistWords: [],
        whitelist: [],
        allowedLinks: [],
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
      if (cfg.maxWarnings === undefined) { cfg.maxWarnings = 3; updated = true; }
      if (cfg.blacklistWords === undefined) { cfg.blacklistWords = []; updated = true; }
      if (cfg.whitelist === undefined) { cfg.whitelist = []; updated = true; }
      if (cfg.autonick === undefined) { cfg.autonick = { enabled: false, prefix: '', suffix: '' }; updated = true; }
      if (cfg.quarantineVcId === undefined) { cfg.quarantineVcId = null; updated = true; }
      if (cfg.homeVcId === undefined) { cfg.homeVcId = null; updated = true; }
      if (cfg.antiNukePunishment === undefined) { cfg.antiNukePunishment = 'ban'; updated = true; }
      if (cfg.antiNukeThreshold === undefined) { cfg.antiNukeThreshold = 1; updated = true; }
      if (cfg.antiLinkEnabled === undefined) { cfg.antiLinkEnabled = false; updated = true; }
      if (cfg.antiInviteEnabled === undefined) { cfg.antiInviteEnabled = true; updated = true; }
      if (cfg.allowedLinks === undefined) { cfg.allowedLinks = []; updated = true; }

      if (updated) this.save();
    }
    return this.cache.guilds[guildId];
  }

  updateGuildConfig(guildId, updates) {
    const config = this.getGuildConfig(guildId);
    this.cache.guilds[guildId] = { ...config, ...updates };
    this.save();
    return this.cache.guilds[guildId];
  }

  // Whitelist Manager
  isWhitelisted(guild, userId) {
    if (!guild) return false;
    if (userId === guild.ownerId) return true; // Owner is always immune/whitelisted
    
    // Bot owner is ALWAYS whitelisted/immune
    const ownerIdEnv = process.env.OWNER_ID;
    if (ownerIdEnv && userId === ownerIdEnv) return true;
    
    // Extra owners are always whitelisted/immune
    if (this.isExtraOwner(guild.id, userId)) return true;

    const config = this.getGuildConfig(guild.id);
    return config.whitelist.includes(userId);
  }

  addWhitelist(guildId, userId) {
    const config = this.getGuildConfig(guildId);
    if (!config.whitelist.includes(userId)) {
      config.whitelist.push(userId);
      this.updateGuildConfig(guildId, { whitelist: config.whitelist });
      return true;
    }
    return false;
  }

  removeWhitelist(guildId, userId) {
    const config = this.getGuildConfig(guildId);
    const index = config.whitelist.indexOf(userId);
    if (index !== -1) {
      config.whitelist.splice(index, 1);
      this.updateGuildConfig(guildId, { whitelist: config.whitelist });
      return true;
    }
    return false;
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
    this.cache.jtc[guildId] = { lobbyChannelId, categoryId, panelChannelId, panelMessageId };
    this.save();
  }

  setPanelMessageId(guildId, messageId) {
    if (!this.cache.jtc?.[guildId]) return;
    this.cache.jtc[guildId].panelMessageId = messageId;
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
    if (!this.cache.botWhitelist?.[guildId]) return;
    this.cache.botWhitelist[guildId] = this.cache.botWhitelist[guildId].filter(id => id !== botId);
    this.save();
  }

  isBotWhitelisted(guildId, botId) {
    return (this.cache.botWhitelist?.[guildId] || []).includes(botId);
  }
}

const db = new Database();
export default db;

