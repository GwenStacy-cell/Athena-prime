import fs from "fs";
let lines = fs.readFileSync("src/events/interactionCreate.js", "utf8").split(/\r?\n/);
lines.splice(17, 9); // Remove the corrupted partial block
fs.writeFileSync("src/events/interactionCreate.js", lines.join("\n"));
