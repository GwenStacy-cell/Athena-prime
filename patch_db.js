import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");
js = js.replace(/antiInviteEnabled:\s*true/g, "antiInviteEnabled: false");
js = js.replace(/antiInvite:\s*true/g, "antiInvite: false");
fs.writeFileSync("src/database.js", js);
