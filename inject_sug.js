const fs = require('fs');
let js = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

const oldStr =   async execute(interaction) {;

const newStr =   async execute(interaction) {

    // --- SUGGESTION BUTTONS ---
    if (interaction.isButton() && interaction.customId.startsWith('sug_')) {
      import('../commands/community.js').then(m => {
        if (m.handleSuggestionButtons) m.handleSuggestionButtons(interaction).catch(()=>{});
      }).catch(()=>{});
      return;
    };

js = js.replace(oldStr, newStr);
fs.writeFileSync('src/events/interactionCreate.js', js);
console.log('Injected suggestion handler!');
