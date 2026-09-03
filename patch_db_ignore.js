import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");

const oldSchema = `      authRoles: { admin: [], mod: [], staff: [] },`;
const newSchema = `      authRoles: { admin: [], mod: [], staff: [] },
      ignoredChannels: [],
      ignoredCategories: [],`;

js = js.replace(oldSchema, newSchema);

// Add getters and setters
const newMethods = `
  // --- COMMAND IGNORE SYSTEM ---
  getIgnoredChannels(guildId) {
    this.ensureGuildCache(guildId);
    return this.cache.guilds[guildId].ignoredChannels || [];
  }

  updateIgnoredChannels(guildId, channels) {
    this.ensureGuildCache(guildId);
    this.cache.guilds[guildId].ignoredChannels = channels;
    this.save();
  }

  getIgnoredCategories(guildId) {
    this.ensureGuildCache(guildId);
    return this.cache.guilds[guildId].ignoredCategories || [];
  }

  updateIgnoredCategories(guildId, categories) {
    this.ensureGuildCache(guildId);
    this.cache.guilds[guildId].ignoredCategories = categories;
    this.save();
  }
`;

js = js.replace("  // --- MODERATION ---", newMethods + "\n  // --- MODERATION ---");

fs.writeFileSync("src/database.js", js);
