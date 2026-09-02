import fs from "fs";
let js = fs.readFileSync("src/commands/welcome.js", "utf8");
fs.writeFileSync("src/commands/welcome_backup.js", js);
