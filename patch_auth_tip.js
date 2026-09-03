import fs from "fs";
let js = fs.readFileSync("src/commands/auth.js", "utf8");

const oldHeader = "Grants access to basic moderation commands.` }";
const newHeader = "Grants access to basic moderation commands.\\n\\n-# <:emoji_16:1521464002046328944> **Tip:** Users can run \\`!tier\\` to check their clearance level.` }";

js = js.replace(oldHeader, newHeader);

fs.writeFileSync("src/commands/auth.js", js);
