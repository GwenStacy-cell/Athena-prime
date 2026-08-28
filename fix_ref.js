import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Fix the bad replace
code = code.replace(/await getServerSecurityEnabledPanel\(message\.guild \|\| interaction\.guild\)/g, "await getServerSecurityEnabledPanel(typeof message !== 'undefined' ? message.guild : interaction.guild)");

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed reference error!");
