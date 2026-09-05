import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");
let match = js.match(/getGuildConfig\(guildId\) \{[\s\S]*?return this\.cache\.guilds\[guildId\];/);
if (match) console.log(match[0]);
