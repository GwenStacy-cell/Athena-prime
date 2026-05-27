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
  quarantines: {}  // guildId -> { userId -> { roles: [roleIds...], quarantinedAt, reason } }
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
        antiSpamEnabled: true,
        raidMode: false,
        antiNukeEnabled: true,
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

  addQuarantine(guildId, userId, roles, reason) {
    if (!this.cache.quarantines[guildId]) {
      this.cache.quarantines[guildId] = {};
    }
    this.cache.quarantines[guildId][userId] = {
      roles,
      quarantinedAt: Date.now(),
      reason
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
}

const db = new Database();
export default db;

