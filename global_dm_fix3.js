import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");
js = js.replace(/async execute\(interaction\) \{/, "async execute(interaction) {\n  if (!interaction.guild) return;");
fs.writeFileSync("src/events/interactionCreate.js", js);
