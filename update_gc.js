import fs from "fs";
let js = fs.readFileSync("src/events/guildCreate.js", "utf8");

const oldStr = `if (!db.cache.botAnalytics) db.cache.botAnalytics = { joins: 0, leaves: 0, cmds: {} };
      db.cache.botAnalytics.joins++;
      db.save();`;

const newStr = `if (!db.cache.botAnalytics) db.cache.botAnalytics = { joins: 0, leaves: 0, cmds: {} };
      if (!db.cache.botAnalytics.recentJoins) db.cache.botAnalytics.recentJoins = [];
      db.cache.botAnalytics.joins++;
      db.cache.botAnalytics.recentJoins.unshift({ id: guild.id, name: guild.name, addedBy: addedBy || 'Unknown', time: Date.now(), memberCount: guild.memberCount });
      if (db.cache.botAnalytics.recentJoins.length > 20) db.cache.botAnalytics.recentJoins.pop();
      db.save();`;

js = js.replace(oldStr, newStr);
fs.writeFileSync("src/events/guildCreate.js", js);
console.log("Updated guildCreate.js");
