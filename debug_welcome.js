import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(/await quarantineChannel\.send\(Object\.assign\(\{ content: `\$\{targetMember\}` \}, welcomeEmbed\)\)\.catch\(\(\) => null\);/g, "await quarantineChannel.send(Object.assign({ content: `${targetMember}` }, welcomeEmbed)).catch((e) => console.error('QUARANTINE SEND ERROR:', e));");

fs.writeFileSync("src/commands/security.js", text);
