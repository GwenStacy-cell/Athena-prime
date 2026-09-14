import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const oldLine = '"-# The Anti-Nuke engine instantly bans malicious admins and automatically restores deleted channels, roles, and emojis.",';
const newLine = `"-# The Anti-Nuke engine instantly bans malicious admins and automatically restores deleted channels, roles, and emojis.",
      "",
      "**Advanced Architecture Details:**",
      "- **Raw Websocket Wiretap** (<1ms zero-day execution)",
      "- **Lightspeed Detection** (10ms directStrike API polling)",
      "- **Flawless Restoration** (Re-engineers exact channel/category positions)",
      "- **Parallel Retaliation** (Instantly unbans victims while banning the nuker)",
      "- **Deep Emoji Reconstruction** (Recreates custom emojis exactly)",
      "",`;

js = js.replace(oldLine, newLine);
fs.writeFileSync("src/commands/utility.js", js);
console.log("Updated utility.js");
