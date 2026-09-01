import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");
js = js.replace(/\(dbConfig\.antiInviteEnabled\s*\|\|\s*config\.antiInvite\.enabled\)/g, "dbConfig.antiInviteEnabled");
js = js.replace(/\(dbConfig\.antiSpamEnabled\s*\|\|\s*config\.antiSpam\.enabled\)/g, "dbConfig.antiSpamEnabled");
fs.writeFileSync("src/events/messageCreate.js", js);
