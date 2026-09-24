const fs = require('fs');
let code = fs.readFileSync('src/commands/utility.js', 'utf8');

const oldStr = 'reply = await interaction.reply({ components: [components], flags: MessageFlags.IsComponentsV2, withResponse: true });';
const newStr = 'await interaction.reply({ components: [components], flags: MessageFlags.IsComponentsV2 });\n        reply = await interaction.fetchReply();';

code = code.replace(oldStr, newStr);
fs.writeFileSync('src/commands/utility.js', code);
