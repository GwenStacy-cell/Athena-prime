import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");
code = code.replace(/const \{.*?\} = require\(['"]discord\.js['"]\);/g, '');
fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Removed all require() statements.");
