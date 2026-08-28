import fs from "fs";
let code = fs.readFileSync("src/commands/rolemanager.js", "utf8");

code = code.replace(/\{ embeds: \[finishEmbed\] \}/g, "finishEmbed");
code = code.replace(/\{ embeds: \[errEmbed\] \}/g, "errEmbed");

fs.writeFileSync("src/commands/rolemanager.js", code);
console.log("Fixed rolemanager.js variables!");
