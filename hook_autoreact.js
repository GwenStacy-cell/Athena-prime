import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const hookCode = `
    if (interaction.isButton() || interaction.isAnySelectMenu()) {
      if (interaction.customId.startsWith('autoreact_')) {
        const { handleAutoReactButton, handleAutoReactMenu } = await import('../commands/autoreact.js');
        if (interaction.isButton()) return handleAutoReactButton(interaction);
        if (interaction.isAnySelectMenu()) return handleAutoReactMenu(interaction);
      }
`;

js = js.replace(/if \(interaction\.isButton\(\) \|\| interaction\.isAnySelectMenu\(\)\) \{/, hookCode);

const modalHookCode = `
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('autoreact_modal_')) {
        const { handleAutoReactModal } = await import('../commands/autoreact.js');
        return handleAutoReactModal(interaction);
      }
`;

js = js.replace(/if \(interaction\.isModalSubmit\(\)\) \{/, modalHookCode);

fs.writeFileSync("src/events/interactionCreate.js", js);
