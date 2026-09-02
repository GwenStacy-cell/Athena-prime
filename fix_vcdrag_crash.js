import fs from "fs";
let vc = fs.readFileSync("src/commands/vcdrag.js", "utf8");
vc = vc.replace(/!isBotOwnerSync\(message\.author\.id\)/g, "!isBotOwnerSync(moderator.id)");
fs.writeFileSync("src/commands/vcdrag.js", vc);
