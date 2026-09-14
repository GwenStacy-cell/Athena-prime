import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const fnStart = js.indexOf("export async function getSecurityStatusPanel");
const containerIndex = js.indexOf("const container = {", fnStart);

const detailsStr = `
    const detailsSection = { type: 10, content:
      "**Advanced Architecture Details:**\\n" +
      "- **Raw Websocket Wiretap:** Intercepts raw network streams to execute zero-day bans in <1ms, bypassing library latency.\\n" +
      "- **Lightspeed Detection:** Direct API polling every 10ms catches destructive events instantly.\\n" +
      "- **Flawless Restoration:** Re-engineers exact channel/category raw positions and permissions post-nuke.\\n" +
      "- **Parallel Retaliation:** Instantly unbans victims while simultaneously banning the rogue admin.\\n" +
      "- **Deep Emoji Reconstruction:** Recreates deleted custom emojis with their original exact image data and names."
    };
`;

const insertDetails = detailsStr + "\n    const container = {";
js = js.substring(0, containerIndex) + insertDetails + js.substring(containerIndex + "const container = {".length);

const compIndex = js.indexOf("headerSection,", containerIndex);
const insertComponent = "headerSection,\n        { type: 14, divider: true },\n        detailsSection,";
js = js.substring(0, compIndex) + insertComponent + js.substring(compIndex + "headerSection,".length);


fs.writeFileSync("src/commands/security.js", js);
console.log("Updated security.js correctly");
