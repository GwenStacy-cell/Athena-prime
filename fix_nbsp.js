import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

code = code.replace(/\\u2003\\u2003\\u2003\\u2003\\u2003/g, "\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0");

fs.writeFileSync("src/commands/security.js", code);
console.log("Swapped Em Spaces for 15 Non-Breaking Spaces!");
