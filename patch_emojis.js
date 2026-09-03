import fs from "fs";

let jsAuth = fs.readFileSync("src/commands/auth.js", "utf8");
jsAuth = jsAuth.replace(/<:emoji_16:1521464002046328944>/g, "<:tickred:1533860144822358178>");
fs.writeFileSync("src/commands/auth.js", jsAuth);

let jsTier = fs.readFileSync("src/commands/tier.js", "utf8");
jsTier = jsTier.replace(/<:ticks:1533860039213842565>/g, "<:tickred:1533860144822358178>");
jsTier = jsTier.replace(/<:emoji_16:1521464002046328944>/g, "<:tickred:1533860144822358178>");
fs.writeFileSync("src/commands/tier.js", jsTier);

