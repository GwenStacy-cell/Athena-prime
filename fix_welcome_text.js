import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");
text = text.replace(/> -# Reason: \. \$\{targetMember\} , \*\*Security Isolation Active\*\*/g, "> -# **Hello ${targetMember} , Security Isolation Active**");
fs.writeFileSync("src/commands/security.js", text);
