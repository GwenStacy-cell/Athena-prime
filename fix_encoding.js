import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

// Fix the quarantine description
text = text.replace(/Isolates a user .*? strips roles/, "Isolates a user - strips roles");
fs.writeFileSync("src/commands/security.js", text);
