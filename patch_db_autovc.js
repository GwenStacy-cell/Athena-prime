import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");

const oldMethods = `  getTtsPrefs(userId) {`;
const newMethods = `  getAutoTtsVc(guildId) {
    if (!this.cache.tts) this.cache.tts = { users: {}, autoTts: {}, autoVc: {} };
    if (!this.cache.tts.autoVc) this.cache.tts.autoVc = {};
    return this.cache.tts.autoVc[guildId] || null;
  }

  setAutoTtsVc(guildId, vcId) {
    if (!this.cache.tts) this.cache.tts = { users: {}, autoTts: {}, autoVc: {} };
    if (!this.cache.tts.autoVc) this.cache.tts.autoVc = {};
    this.cache.tts.autoVc[guildId] = vcId;
    this.save();
  }

  getTtsPrefs(userId) {`;

js = js.replace(oldMethods, newMethods);

fs.writeFileSync("src/database.js", js);
