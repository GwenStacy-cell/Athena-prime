import fs from "fs";
let js = fs.readFileSync("src/utils/antinuke.js", "utf8");

js = js.replace(
  "[AuditLogEvent.BotAdd]:            mods.antiBotAdd,",
  "[AuditLogEvent.BotAdd]:            mods.antiBotAdd,\n      [1]: mods.antiServerUpdate, // GuildUpdate\n      [11]: mods.antiRoleUpdate, // RoleUpdate"
);

fs.writeFileSync("src/utils/antinuke.js", js);
