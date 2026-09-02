import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");
js = js.replace(/async function handleSecurityInteractions\(interaction, guild\) \{/, 
  "async function handleSecurityInteractions(interaction, guild) {\n  if (!guild) return;");
fs.writeFileSync("src/events/interactionCreate.js", js);
