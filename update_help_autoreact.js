import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const original = "`!setguildavatar` / `!setguildbanner` - Set bot's custom per-server avatar/banner `[extra owners]`', '`/steal` `:emoji: ...` - Steal multiple emojis into your server `[extra owners]`', '`!stealemoji` - Cross-server Emoji Stealer `[bot/server owner]`'] }";
const updated = original.replace("] }", ", '`!autoreact` - Open the Auto-React Configuration Dashboard `[extra owners]`'] }");

js = js.replace(original, updated);
fs.writeFileSync("src/commands/utility.js", js);
