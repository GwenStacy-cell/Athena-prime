import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");

const oldSchema = `        this.cache.tts            = this.cache.tts            || { users: {}, autoTts: {}, autoVc: {} };`;
const newSchema = `        this.cache.tts            = this.cache.tts            || { users: {}, autoTts: {}, autoVc: {} };
        this.cache.apps           = this.cache.apps           || {};`;

js = js.replace(oldSchema, newSchema);

const newMethods = `
  // --- APP BUILDER SYSTEM ---
  getAppConfig(guildId) {
    if (!this.cache.apps) this.cache.apps = {};
    if (!this.cache.apps[guildId]) {
      this.cache.apps[guildId] = {
        logChannel: null,
        questions: ["Why do you want to be staff?", "What is your timezone?", "Do you have prior experience?"]
      };
    }
    return this.cache.apps[guildId];
  }

  updateAppConfig(guildId, data) {
    const config = this.getAppConfig(guildId);
    this.cache.apps[guildId] = { ...config, ...data };
    this.save();
  }
`;

js = js.replace(/\n}\s*const dbInstance = new Database\(\);/, newMethods + "\n}\nconst dbInstance = new Database();");

fs.writeFileSync("src/database.js", js);
