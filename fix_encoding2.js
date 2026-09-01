import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

// Fix the automatically released description
text = text.replace(/quarantine duration expired .*? automatically released\./, "quarantine duration expired - automatically released.");
fs.writeFileSync("src/commands/security.js", text);
