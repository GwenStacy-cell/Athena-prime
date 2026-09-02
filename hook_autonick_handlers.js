import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const buttonHook = `
    if (interaction.isButton() || interaction.isAnySelectMenu()) {
      if (interaction.customId.startsWith('autonick_')) {
        const { handleAutonickButton } = await import('../commands/security.js');
        return handleAutonickButton(interaction);
      }`;

js = js.replace(/if \(interaction\.isButton\(\) \|\| interaction\.isAnySelectMenu\(\)\) \{/, buttonHook);

const modalHook = `
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'autonick_modal') {
        const { handleAutonickModal } = await import('../commands/security.js');
        return handleAutonickModal(interaction);
      }`;

js = js.replace(/if \(interaction\.isModalSubmit\(\)\) \{/, modalHook);

fs.writeFileSync("src/events/interactionCreate.js", js);
