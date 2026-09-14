import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

js = js.replace(
  "const botOwnerId = '1509084068619489331';\n      if (interaction.user.id !== interaction.guild.ownerId && interaction.user.id !== botOwnerId) {",
  "if (interaction.user.id !== interaction.guild.ownerId && !isBotOwnerSync(interaction.user.id)) {"
);

js = js.replace(
  "const botOwnerId = '1509084068619489331';\n      const i = interaction;\n      if (i.user.id !== i.guild.ownerId && i.user.id !== botOwnerId) {",
  "const i = interaction;\n      if (i.user.id !== i.guild.ownerId && !isBotOwnerSync(i.user.id)) {"
);

fs.writeFileSync("src/events/interactionCreate.js", js);
console.log("Patched again!");
