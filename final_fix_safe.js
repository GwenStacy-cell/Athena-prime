import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Change the exact line from: 
//   ↳ Server Id :
// to:
//   ╰› Server Id :
code = code.replace(/\u00A0\u00A0\u21b3/g, '\u00A0\u00A0\u2570\u203A');
code = code.replace(/↳/g, '╰›');

fs.writeFileSync("src/commands/security.js", code);
console.log("Safely replaced pointers!");
