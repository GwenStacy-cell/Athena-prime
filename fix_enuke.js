import fs from 'fs';
let code = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

// Add modal handler
const modalSearchStr = `      // Handle Whitelist limit modal`;
const modalInjectStr = `      if (interaction.customId.startsWith('enuke_modal_')) {
        const { handleEnukeModal } = await import('../commands/enuke.js');
        return handleEnukeModal(interaction);
      }
`;
code = code.replace(modalSearchStr, modalInjectStr + '\n' + modalSearchStr);

// Add button handler
const buttonSearchStr = `      // RATE EDIT BUTTONS`;
const buttonInjectStr = `      // ENUKE BUTTON
      if (interaction.customId.startsWith('enuke_open_manager_')) {
        const { handleEnukeButton } = await import('../commands/enuke.js');
        return handleEnukeButton(interaction);
      }

`;
code = code.replace(buttonSearchStr, buttonInjectStr + buttonSearchStr);

fs.writeFileSync('src/events/interactionCreate.js', code);
