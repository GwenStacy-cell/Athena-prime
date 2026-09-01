import fs from "fs";

let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const patch = `
    if (interaction.isButton() || interaction.isAnySelectMenu()) {
      if (interaction.customId.startsWith('welcmgr_') || interaction.customId.startsWith('leavmgr_')) {
        const { handleWelcomeManagerButton, handleWelcomeManagerMenu } = await import('../commands/welcome.js');
        if (interaction.isButton()) return handleWelcomeManagerButton(interaction);
        if (interaction.isAnySelectMenu()) return handleWelcomeManagerMenu(interaction);
      }
`;

js = js.replace("if (interaction.isButton() || interaction.isAnySelectMenu()) {", patch);

const modalPatch = `
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('welc_modal_') || interaction.customId.startsWith('leav_modal_')) {
        const { handleWelcomeManagerModal } = await import('../commands/welcome.js');
        return handleWelcomeManagerModal(interaction);
      }
`;

js = js.replace("if (interaction.isModalSubmit()) {", modalPatch);

fs.writeFileSync("src/events/interactionCreate.js", js);
console.log("Patched interactionCreate.js");
