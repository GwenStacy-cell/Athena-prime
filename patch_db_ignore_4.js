import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");

const oldCode = "const dbInstance = new Database();";
const newCode = `
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

const dbInstance = new Database();`;

// Also need to remove the closing bracket right before const dbInstance
js = js.replace(/}\s*const dbInstance = new Database\(\);/, newCode);

fs.writeFileSync("src/database.js", js);
