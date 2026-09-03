import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

js = js.replace(/return interaction\.showModal\(modal\);\s*\}\s*else if \(customId === 'am_select_granular_role'\) \{/g, "return interaction.showModal(modal);\n        });\n      }\n      else if (customId === 'am_select_granular_role') {");

fs.writeFileSync("src/events/interactionCreate.js", js);
