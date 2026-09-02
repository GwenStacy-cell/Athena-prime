import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");
js = js.replace(/async execute\(interaction\) \{\n    try \{\n      const guild = interaction\.guild;/, 
  "async execute(interaction) {\n    if (!interaction.guild) return;\n    try {\n      const guild = interaction.guild;");
fs.writeFileSync("src/events/interactionCreate.js", js);
