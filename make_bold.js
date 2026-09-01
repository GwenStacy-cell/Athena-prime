import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");
text = text.replace(/-# Hello \$\{targetMember\.user\.username\} , \*\*You/g, "-# **Hello ${targetMember.user.username} , You");
text = text.replace(/Quarantined in \$\{guild\.name\}\*\*/g, "Quarantined in ${guild.name}**");
fs.writeFileSync("src/commands/security.js", text);
