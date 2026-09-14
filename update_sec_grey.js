import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

// We need to find the detailsSection block
const oldStr = `
    const detailsSection = { type: 10, content:
      "**Advanced Architecture Details:**\\n" +
      "- **Raw Websocket Wiretap:** Intercepts raw network streams to execute zero-day bans in <1ms, bypassing library latency.\\n" +
      "- **Lightspeed Detection:** Direct API polling every 10ms catches destructive events instantly.\\n" +
      "- **Flawless Restoration:** Re-engineers exact channel/category raw positions and permissions post-nuke.\\n" +
      "- **Parallel Retaliation:** Instantly unbans victims while simultaneously banning the rogue admin.\\n" +
      "- **Deep Emoji Reconstruction:** Recreates deleted custom emojis with their original exact image data and names."
    };
`;

const newStr = `
    const detailsSection = { type: 10, content:
      "-# **Advanced Architecture Details:**\\n" +
      "-# **Raw Websocket Wiretap:** Intercepts raw network streams to execute zero-day bans in <1ms, bypassing library latency.\\n" +
      "-# **Lightspeed Detection:** Direct API polling every 10ms catches destructive events instantly.\\n" +
      "-# **Flawless Restoration:** Re-engineers exact channel/category raw positions and permissions post-nuke.\\n" +
      "-# **Parallel Retaliation:** Instantly unbans victims while simultaneously banning the rogue admin.\\n" +
      "-# **Deep Emoji Reconstruction:** Recreates deleted custom emojis with their original exact image data and names."
    };
`;

js = js.replace(oldStr.trim(), newStr.trim());
fs.writeFileSync("src/commands/security.js", js);
console.log("Updated security.js");
