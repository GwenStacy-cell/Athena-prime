import fs from "fs";
let js = fs.readFileSync("src/commands/ezal.js", "utf8");

js = js.replace("export { handleBackup };", "export { handleBackup, generateBackupId, serializeGuild, restoreGuild };");
fs.writeFileSync("src/commands/ezal.js", js);
