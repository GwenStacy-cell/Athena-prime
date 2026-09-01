import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");
text = text.replace(/await quarantineChannel\.send\(welcomeEmbed\)\.catch\(\(\) => null\);/g, "await quarantineChannel.send(welcomeEmbed).catch((e) => console.error('QUARANTINE_SEND_ERROR:', e));");
fs.writeFileSync("src/commands/security.js", text);
