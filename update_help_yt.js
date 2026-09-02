import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const original = "`!bi` / `!botstats` - View global Athena internal statistics `[bot owner]`'] }";
const updated = "`!bi` / `!botstats` - View global Athena internal statistics `[bot owner]`', '`!ytstats` - Build dynamic Voice Channels tracking YouTube Subs `[extra owners]`'] }";

js = js.replace(original, updated);
fs.writeFileSync("src/commands/utility.js", js);
