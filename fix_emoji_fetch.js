
import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");
let dash = fs.readFileSync("src/utils/dashboardManager.js", "utf8");

// Fix emojis
sec = sec.replace(/<:emoji_16:1521464002046328944>/g, "<:emoji_16:1533860111704002665>");

// Fix rate limit crash in getSecureDashboardPanel
sec = sec.replace("await guild.members.fetch();", "await guild.members.fetch().catch(() => null);");

// Fix rate limit crash in dashboardManager.js
dash = dash.replace("await guild.members.fetch();", "await guild.members.fetch().catch(() => null);");

fs.writeFileSync("src/commands/security.js", sec);
fs.writeFileSync("src/utils/dashboardManager.js", dash);
console.log("Fixed emojis and fetch rate limits");

