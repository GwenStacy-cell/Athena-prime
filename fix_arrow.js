import fs from "fs";

let text = fs.readFileSync("src/events/messageCreate.js", "utf8");
text = text.replace(/╰›/g, "↳");
fs.writeFileSync("src/events/messageCreate.js", text);

let text2 = fs.readFileSync("src/commands/security.js", "utf8");
text2 = text2.replace(/╰›/g, "↳");
fs.writeFileSync("src/commands/security.js", text2);
