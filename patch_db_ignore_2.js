import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");

const oldSchema = `          welcomeChannel: null,`;
const newSchema = `          welcomeChannel: null,
          ignoredChannels: [],
          ignoredCategories: [],`;

js = js.replace(oldSchema, newSchema);

const newMethods = `
  // --- IGNORE SYSTEM ---
  getIgnoredChannels(guildId) {
    const config = this.getGuildConfig(guildId);
    if (!config.ignoredChannels) config.ignoredChannels = [];
    return config.ignoredChannels;
  }

  updateIgnoredChannels(guildId, channels) {
    const config = this.getGuildConfig(guildId);
    config.ignoredChannels = channels;
    this.save();
  }

  getIgnoredCategories(guildId) {
    const config = this.getGuildConfig(guildId);
    if (!config.ignoredCategories) config.ignoredCategories = [];
    return config.ignoredCategories;
  }

  updateIgnoredCategories(guildId, categories) {
    const config = this.getGuildConfig(guildId);
    config.ignoredCategories = categories;
    this.save();
  }
`;

js = js.replace("  // --- MODERATION ---", newMethods + "\n  // --- MODERATION ---");

fs.writeFileSync("src/database.js", js);
