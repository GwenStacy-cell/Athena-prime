import fs from "fs";
let code = fs.readFileSync("src/commands/record.js", "utf8");

code = code.replace(/try \{\r?\n          \/\/ If we are in DMs/, "// If we are in DMs");
code = code.replace(/const vc = message\.member\.voice\.channel;/, "const vc = message.member?.voice?.channel;");

fs.writeFileSync("src/commands/record.js", code);
console.log("Fixed try block and member access in stop!");
