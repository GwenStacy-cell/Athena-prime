import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// Look for modal submission block
const searchCode = `  if (interaction.isModalSubmit()) {`;
const insertCode = `  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_quote_id' || interaction.customId === 'modal_quote_custom') {
      import('../commands/quote.js').then(m => m.handleQuoteModals(interaction)).catch(console.error);
      return;
    }
`;

js = js.replace(searchCode, insertCode);
fs.writeFileSync("src/events/interactionCreate.js", js);
