import fs from "fs";
let text = fs.readFileSync("src/utils/serverLogger.js", "utf8");
text = text.replace(
    "require('fs')",
    "(await import('fs'))"
);
fs.writeFileSync("src/utils/serverLogger.js", text);
