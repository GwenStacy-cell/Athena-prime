import db from "./src/database.js";
const data = db.getAllGuildConfigs();
let changed = false;

for (const [guildId, config] of Object.entries(data)) {
  if (config.ytStats) {
    for (const stat of config.ytStats) {
      if (stat.format.includes("🔴")) {
        stat.format = stat.format.replace(/🔴 /g, "");
        changed = true;
      }
      if (stat.format.includes("🎬")) {
        stat.format = stat.format.replace(/🎬 /g, "");
        changed = true;
      }
      if (stat.format.includes("👀")) {
        stat.format = stat.format.replace(/👀 /g, "");
        changed = true;
      }
    }
    if (changed) {
      db.updateGuildConfig(guildId, { ytStats: config.ytStats });
    }
  }
}
if (changed) console.log("Database sanitized!");
else console.log("No native emojis found in database.");
