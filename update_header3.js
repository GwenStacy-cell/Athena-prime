import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");

const oldHeaderRegex = /const headerSection = \{ type: 10, content: \r?\n      "-# \*\*SECURITY FIREWALL STATUS\*\*\\n" \+/;

const newHeader = `const headerSection = { type: 10, content: 
      "# SECURITY FIREWALL STATUS\\n" +`;

sec = sec.replace(oldHeaderRegex, newHeader);
fs.writeFileSync("src/commands/security.js", sec);
