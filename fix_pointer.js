import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Replace the pointer
code = code.replace(/\u00A0\u00A0\u21b3/g, '\u00A0\u00A0\u2570\u203A'); // ╰› is \u2570\u203A
code = code.replace(/↳/g, '╰›');

fs.writeFileSync("src/commands/security.js", code);
console.log("Replaced pointer with ╰› !");
