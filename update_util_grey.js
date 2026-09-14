import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const oldStr = `
      "**Advanced Architecture Details:**",
      "- **Raw Websocket Wiretap** (<1ms zero-day execution)",
      "- **Lightspeed Detection** (10ms directStrike API polling)",
      "- **Flawless Restoration** (Re-engineers exact channel/category positions)",
      "- **Parallel Retaliation** (Instantly unbans victims while banning the nuker)",
      "- **Deep Emoji Reconstruction** (Recreates custom emojis exactly)",
`;

const newStr = `
      "-# **Advanced Architecture Details:**",
      "-# **Raw Websocket Wiretap** (<1ms zero-day execution)",
      "-# **Lightspeed Detection** (10ms directStrike API polling)",
      "-# **Flawless Restoration** (Re-engineers exact channel/category positions)",
      "-# **Parallel Retaliation** (Instantly unbans victims while banning the nuker)",
      "-# **Deep Emoji Reconstruction** (Recreates custom emojis exactly)",
`;

js = js.replace(oldStr.trim(), newStr.trim());
fs.writeFileSync("src/commands/utility.js", js);
console.log("Updated utility.js");
