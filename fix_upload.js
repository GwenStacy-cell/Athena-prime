import fs from "fs";
let js = fs.readFileSync("src/commands/upload.js", "utf8");
js = js.replace(/Fetching \\\`\$\{filename\}\\\`/g, "Fetching \\`${targetFilename}\\`");
fs.writeFileSync("src/commands/upload.js", js);
