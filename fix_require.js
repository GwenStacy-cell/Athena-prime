import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");

code = code.replace(/const \{ ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder \} = require\("discord\.js"\);\s*/g, "");

fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Removed require() calls!");
