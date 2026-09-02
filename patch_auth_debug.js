import fs from "fs";
let js = fs.readFileSync("src/commands/auth.js", "utf8");

js = js.replace("await message.reply(payload).catch(() => null);", "await message.reply(payload);");

fs.writeFileSync("src/commands/auth.js", js);
