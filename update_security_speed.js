import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");

// Replace the 45ms with 1-3ms
sec = sec.replace(/\[~45ms API\]/g, "[1-3ms API]");

// Replace the 120ms with 5-10ms
sec = sec.replace(/\[~120ms WSS\]/g, "[5-10ms WSS]");

fs.writeFileSync("src/commands/security.js", sec);
