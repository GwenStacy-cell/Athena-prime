import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");
text = text.replace(/ \?/g, "\u2570\u203A");
fs.writeFileSync("src/commands/security.js", text);
