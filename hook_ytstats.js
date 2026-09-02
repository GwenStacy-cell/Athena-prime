import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const hookMenu = `
      if (interaction.customId.startsWith('ytstats_')) {
        const { handleYtStatsButton } = await import('../commands/ytstats.js');
        if (interaction.isButton()) return handleYtStatsButton(interaction);
      }
      if (interaction.customId.startsWith('autorole_')) {
`;
js = js.replace("      if (interaction.customId.startsWith('autorole_')) {", hookMenu);

const hookModal = `
      if (interaction.customId === 'ytstats_bind_modal') {
        const { handleYtStatsModal } = await import('../commands/ytstats.js');
        return handleYtStatsModal(interaction);
      }
      if (interaction.customId.startsWith('autorole_modal_') || interaction.customId === 'autorole_vanity_modal') {
`;
js = js.replace("      if (interaction.customId.startsWith('autorole_modal_') || interaction.customId === 'autorole_vanity_modal') {", hookModal);

fs.writeFileSync("src/events/interactionCreate.js", js);
