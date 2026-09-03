import fs from "fs";
let js = fs.readFileSync("src/commands/app.js", "utf8");

js = js.replace(".setEmoji('<:emoji_16:1521464002046328944>')", ".setEmoji('1521464002046328944')");

fs.writeFileSync("src/commands/app.js", js);
