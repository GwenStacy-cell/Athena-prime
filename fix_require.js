import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");
text = text.replace("require('discord.js')", "await import('discord.js')");
fs.writeFileSync("src/events/messageCreate.js", text);
