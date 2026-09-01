import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");
js = js.replace(/if\s*\(config\.antiSpam\.enabled\s*&&\s*\(/g, "if ((");
fs.writeFileSync("src/events/messageCreate.js", js);
