import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");
code = code.replace(/ephemeral: true/g, "flags: MessageFlags.Ephemeral");
fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Mass replaced ephemeral in interactionCreate.js!");
