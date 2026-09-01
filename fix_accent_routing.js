import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const accentButtonCode = `        if (interaction.customId.startsWith('accent_') && !interaction.isModalSubmit()) {
          const { handleAccentButton } = await import('../commands/accent.js');
          return handleAccentButton(interaction);
        }
`;

const accentModalCode = `        if (interaction.customId === 'accent_modal') {
          const { handleAccentModal } = await import('../commands/accent.js');
          return handleAccentModal(interaction);
        }
`;

// Inject into isButton || isAnySelectMenu
code = code.replace("if (interaction.isButton() || interaction.isAnySelectMenu()) {", "if (interaction.isButton() || interaction.isAnySelectMenu()) {\n" + accentButtonCode);

// Inject into isModalSubmit
code = code.replace("if (interaction.isModalSubmit()) {", "if (interaction.isModalSubmit()) {\n" + accentModalCode);

fs.writeFileSync("src/events/interactionCreate.js", code);
