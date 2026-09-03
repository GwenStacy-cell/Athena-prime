import fs from "fs";
let js = fs.readFileSync("src/commands/app.js", "utf8");

js = js.replace(".setEmoji('1521464002046328944')", "");

fs.writeFileSync("src/commands/app.js", js);
