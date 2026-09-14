import fs from "fs";
let js = fs.readFileSync("src/events/guildDelete.js", "utf8");

const oldStr = `if (!db.cache.botAnalytics) db.cache.botAnalytics = { joins: 0, leaves: 0, cmds: {} };
      db.cache.botAnalytics.leaves++;
      db.save();`;

const newStr = `if (!db.cache.botAnalytics) db.cache.botAnalytics = { joins: 0, leaves: 0, cmds: {} };
      if (!db.cache.botAnalytics.recentLeaves) db.cache.botAnalytics.recentLeaves = [];
      db.cache.botAnalytics.leaves++;
      db.cache.botAnalytics.recentLeaves.unshift({ id: guild.id, name: guild.name, ownerId: guild.ownerId, time: Date.now() });
      if (db.cache.botAnalytics.recentLeaves.length > 20) db.cache.botAnalytics.recentLeaves.pop();
      db.save();`;

js = js.replace(/if \(\!db\.cache\.botAnalytics\).*db\.save\(\);/s, newStr);

fs.writeFileSync("src/events/guildDelete.js", js);
console.log("Updated guildDelete.js");
