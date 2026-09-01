import fs from "fs";

let js = fs.readFileSync("src/commands/loader.js", "utf8");

// Add import
const importStr = "import siCmd from './si.js';";
const newImportStr = "import siCmd from './si.js';\nimport uploadCmd from './upload.js';";
js = js.replace(importStr, newImportStr);

// Add to array
const arrayStr = "siCmd,";
const newArrayStr = "siCmd,\n  uploadCmd,";
js = js.replace(arrayStr, newArrayStr);

fs.writeFileSync("src/commands/loader.js", js);
