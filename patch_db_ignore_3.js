import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");

// Remove the closing bracket of the class and append methods
js = js.replace(/\n}\s*$/, `
  // --- IGNORE SYSTEM ---
  getIgnoredChannels(guildId) {
    const config = this.getGuildConfig(guildId);
    if (!config.ignoredChannels) {
      config.ignoredChannels = [];
      this.save();
    }
    return config.ignoredChannels;
  }

  updateIgnoredChannels(guildId, channels) {
    const config = this.getGuildConfig(guildId);
    config.ignoredChannels = channels;
    this.save();
  }

  getIgnoredCategories(guildId) {
    const config = this.getGuildConfig(guildId);
    if (!config.ignoredCategories) {
      config.ignoredCategories = [];
      this.save();
    }
    return config.ignoredCategories;
  }

  updateIgnoredCategories(guildId, categories) {
    const config = this.getGuildConfig(guildId);
    config.ignoredCategories = categories;
    this.save();
  }
}
`);

fs.writeFileSync("src/database.js", js);
