import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

js = js.replace(
  "if (interaction.customId === 'ytstats_bind_modal') {",
  "if (interaction.customId === 'ytstats_bind_modal' || interaction.customId === 'ytstats_auto_modal') {"
);

fs.writeFileSync("src/events/interactionCreate.js", js);
