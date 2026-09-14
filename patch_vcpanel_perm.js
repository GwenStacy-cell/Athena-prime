import fs from "fs";
let js = fs.readFileSync("src/commands/vcpanel.js", "utf8");

js = js.replace(
  "export const commands = [",
  "import { isBotOwnerSync } from '../utils/helpers.js';\n\nexport const commands = ["
);

js = js.replace(
  "const botOwnerId = process.env.OWNER_ID;\n      if (message.author.id !== message.guild.ownerId && message.author.id !== botOwnerId) {",
  "if (message.author.id !== message.guild.ownerId && !isBotOwnerSync(message.author.id)) {"
);

fs.writeFileSync("src/commands/vcpanel.js", js);
console.log("Patched vcpanel.js permissions!");
