import fs from 'fs';
import path from 'path';

const DB_DIR = path.resolve('data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure database directory and file exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DEFAULT_SCHEMA = {
  guilds: {},      // guildId -> { prefix, logChannel, muteRoleId, quarantineRoleId, quarantineChannelId, antiSpamEnabled, raidMode }
  warnings: {},    // guildId -> { userId -> [ { warnerId, reason, timestamp } ] }
  quarantines: {}, // guildId -> { userId -> { roles: [roleIds...], quarantinedAt, reason } }
  extraOwners: {}, // guildId -> [ userId, userId, ... ]
  spamPermitted: []// global list of userIds permitted to use the spam command
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
        this.cache.guilds = this.cache.guilds || {};
        this.cache.warnings = this.cache.warnings || {};
        this.cache.quarantines = this.cache.quarantines || {};
        this.cache.extraOwners = this.cache.extraOwners || {};
        this.cache.spamPermitted = this.cache.spamPermitted || [];
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
        raidMode: false,
        antiNukeEnabled: true,
        antiNukePunishment: 'ban', // default is 'ban'
        antiNukeThreshold: 1, // default is 1 action
        maxWarnings: 3,
        blacklistWords: [],
        whitelist: [],
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

  addQuarantine(guildId, userId, roles, reason, previousVoiceChannelId = null) {
    if (!this.cache.quarantines[guildId]) {
      this.cache.quarantines[guildId] = {};
    }
    this.cache.quarantines[guildId][userId] = {
      roles,
      quarantinedAt: Date.now(),
      reason,
      previousVoiceChannelId
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
}

const db = new Database();
export default db;

