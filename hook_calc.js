import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const hook = `
    if (interaction.isButton() || interaction.isAnySelectMenu()) {
      if (interaction.customId.startsWith('calc_')) {
        const { handleCalculatorButton } = await import('../commands/utility.js');
        return handleCalculatorButton(interaction);
      }`;

js = js.replace(/if \(interaction\.isButton\(\) \|\| interaction\.isAnySelectMenu\(\)\) \{/, hook);

fs.writeFileSync("src/events/interactionCreate.js", js);
