import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");

const oldSchema = `        this.cache.npManagers     = this.cache.npManagers     || [];`;
const newSchema = `        this.cache.npManagers     = this.cache.npManagers     || [];
        this.cache.tts            = this.cache.tts            || { users: {}, autoTts: {} };`;

js = js.replace(oldSchema, newSchema);

const newMethods = `
  // --- TTS SYSTEM ---
  getTtsPrefs(userId) {
    if (!this.cache.tts) this.cache.tts = { users: {}, autoTts: {} };
    if (!this.cache.tts.users[userId]) {
      this.cache.tts.users[userId] = { lang: 'en' };
    }
    return this.cache.tts.users[userId];
  }

  updateTtsPrefs(userId, prefs) {
    if (!this.cache.tts) this.cache.tts = { users: {}, autoTts: {} };
    this.cache.tts.users[userId] = { ...this.getTtsPrefs(userId), ...prefs };
    this.save();
  }

  getAutoTtsUsers(guildId) {
    if (!this.cache.tts) this.cache.tts = { users: {}, autoTts: {} };
    if (!this.cache.tts.autoTts[guildId]) {
      this.cache.tts.autoTts[guildId] = [];
    }
    return this.cache.tts.autoTts[guildId];
  }

  addAutoTtsUser(guildId, userId) {
    const list = this.getAutoTtsUsers(guildId);
    if (!list.includes(userId)) {
      list.push(userId);
      this.save();
    }
  }

  removeAutoTtsUser(guildId, userId) {
    let list = this.getAutoTtsUsers(guildId);
    this.cache.tts.autoTts[guildId] = list.filter(id => id !== userId);
    this.save();
  }
`;

js = js.replace(/\n}\s*const dbInstance = new Database\(\);/, newMethods + "\n}\nconst dbInstance = new Database();");

fs.writeFileSync("src/database.js", js);
