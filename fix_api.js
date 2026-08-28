import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

code = code.replace(/flags: 1 << 13/g, "flags: MessageFlags.IsComponentsV2");
code = code.replace("await sendPayload(currentText);\n}", "await sendPayload(currentText);\n      db.updateGuildConfig(guild.id, { securityEnabled: true, antiNukeEnabled: true });\n}");

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed API crash and DB flag!");
