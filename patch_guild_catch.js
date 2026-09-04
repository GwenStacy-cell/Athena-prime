import fs from "fs";
let js = fs.readFileSync("src/events/guildCreate.js", "utf8");

js = js.replace(
  "await setupDashboardChannel(guild, client).catch(err => console.error('Dashboard init failed on join:', err));",
  "await setupDashboardChannel(guild, client).catch(() => null);"
);

fs.writeFileSync("src/events/guildCreate.js", js);
