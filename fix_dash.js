import fs from "fs";
let code = fs.readFileSync("src/utils/dashboardManager.js", "utf8");

code = code.replace(/await guild\.members\.fetch\(\)\.catch\(\(\) => null\);/g, "await guild.members.fetch().catch(() => guild.members.cache);");

fs.writeFileSync("src/utils/dashboardManager.js", code);
console.log("Fixed dashboard crash!");
