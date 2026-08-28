
import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");
let dash = fs.readFileSync("src/utils/dashboardManager.js", "utf8");

sec = sec.replace(/await guild\.members\.fetch\(\);\s*/g, "await guild.members.fetch().catch(() => null);\n");
dash = dash.replace(/await guild\.members\.fetch\(\);\s*/g, "await guild.members.fetch().catch(() => null);\n");

fs.writeFileSync("src/commands/security.js", sec);
fs.writeFileSync("src/utils/dashboardManager.js", dash);
console.log("Fixed trailing space fetches");

