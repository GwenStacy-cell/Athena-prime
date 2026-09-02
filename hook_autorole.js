import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const hookMenu = `
      if (interaction.customId.startsWith('autorole_')) {
        const { handleAutoRoleButton, handleAutoRoleMenu } = await import('../commands/autorole.js');
        if (interaction.isButton()) return handleAutoRoleButton(interaction);
        if (interaction.isAnySelectMenu()) return handleAutoRoleMenu(interaction);
      }
      if (interaction.customId.startsWith('autoreact_')) {
`;
js = js.replace("      if (interaction.customId.startsWith('autoreact_')) {", hookMenu);

const hookModal = `
      if (interaction.customId.startsWith('autorole_modal_') || interaction.customId === 'autorole_vanity_modal') {
        const { handleAutoRoleModal } = await import('../commands/autorole.js');
        return handleAutoRoleModal(interaction);
      }
      if (interaction.customId.startsWith('autoreact_modal_')) {
`;
js = js.replace("      if (interaction.customId.startsWith('autoreact_modal_')) {", hookModal);

fs.writeFileSync("src/events/interactionCreate.js", js);
