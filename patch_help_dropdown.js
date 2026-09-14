import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

// Append to security module
const oldSec = "`!endemergency` - End emergency mode and restore all permissions `[extra owners]`\"] }";
const newSec = "`!endemergency` - End emergency mode and restore all permissions `[extra owners]`\", \"\", \"-# **God-Tier Security Architecture:**\", \"-# **Raw Websocket Wiretap** (<1ms zero-day execution) & **10ms API polling** ensures perfect channel/role restoration instantly.\"] }";

js = js.replace(oldSec, newSec);

// Append to filters (Automod Firewall)
const oldFil = "`!blacklist add|remove|list phrase` - Auto-delete phrases `[extra owners]`\"] }";
const newFil = "`!blacklist add|remove|list phrase` - Auto-delete phrases `[extra owners]`\", \"\", \"-# **Advanced Threat Firewall:**\", \"-# **Instant Anti-Spam** and **Malicious Link Filtering** engineered directly into Discord's event stream.\"] }";

js = js.replace(oldFil, newFil);

fs.writeFileSync("src/commands/utility.js", js);
console.log("Updated utility.js");
