import fs from "fs";

// Fix rolemanager.js
let rmCode = fs.readFileSync("src/commands/rolemanager.js", "utf8");
rmCode = rmCode.replace(
  "statusMessage = await context.reply({ ...initialReply, fetchReply: true });",
  "await context.reply(initialReply);\n    statusMessage = await context.fetchReply();"
);
fs.writeFileSync("src/commands/rolemanager.js", rmCode);

// Fix utility.js (avatar)
let utilCode = fs.readFileSync("src/commands/utility.js", "utf8");
utilCode = utilCode.replace(
  "reply = await interaction.reply({ components: [components], fetchReply: true, flags: MessageFlags.IsComponentsV2 });",
  "await interaction.reply({ components: [components], flags: MessageFlags.IsComponentsV2 });\n        reply = await interaction.fetchReply();"
);
utilCode = utilCode.replace(
  "const sent = await interaction.reply({ content: 'Calculating ping...', fetchReply: true });",
  "await interaction.reply({ content: 'Calculating ping...' });\n      const sent = await interaction.fetchReply();"
);
fs.writeFileSync("src/commands/utility.js", utilCode);
