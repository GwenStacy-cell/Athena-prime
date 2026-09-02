import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// We'll replace the start of execute to immediately return if not in a guild.
js = js.replace(/async execute\(interaction\) \{\n    try \{\n      const guild = interaction\.guild;\n      if \(guild\) setGuildContext\(guild\.id\);/, 
  "async execute(interaction) {\n    if (!interaction.guild) return;\n    try {\n      const guild = interaction.guild;\n      setGuildContext(guild.id);");

fs.writeFileSync("src/events/interactionCreate.js", js);
