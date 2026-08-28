import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

code = code.replace(/"Establishing Connection with secure server"/g, '"Establishing Connection with Athena\'s server"');
code = code.replace(/\\n> <:dot:1134440854611427388> Server Id : \$\{guild\.id\}\\n> <:dot:1134440854611427388> Secure Security DB ID : \$\{BigInt\(guild\.id\) \* 487293n\}/g, "\n\u21b3 Server Id : ${guild.id}\n\u21b3 Secure Security DB ID : ${BigInt(guild.id) * 487293n}");

fs.writeFileSync("src/commands/security.js", code);
console.log("Re-applied pointer and sequence text!");
