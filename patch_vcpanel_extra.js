import fs from "fs";
let js = fs.readFileSync("src/commands/vcpanel.js", "utf8");

// Add isExtraOwner to the imports
js = js.replace(
  "import { isBotOwnerSync } from '../utils/helpers.js';",
  "import { isBotOwnerSync, isExtraOwner } from '../utils/helpers.js';"
);

// Replace the silent permission check with a verbose one that allows Extra Owners
js = js.replace(
  "if (message.author.id !== message.guild.ownerId && !isBotOwnerSync(message.author.id)) {\n        return; // Ignore completely if not authorized",
  "if (message.author.id !== message.guild.ownerId && !isBotOwnerSync(message.author.id) && !isExtraOwner(message.guild.id, message.author.id)) {\n        return message.reply({ content: 'Only the Server Owner, Bot Owner, and Extra Owners can use this panel.' }).catch(()=>{});"
);

fs.writeFileSync("src/commands/vcpanel.js", js);

let ic = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// Add isExtraOwner to the imports
ic = ic.replace(
  "import { isBotOwnerSync } from '../utils/helpers.js';",
  "import { isBotOwnerSync, isExtraOwner } from '../utils/helpers.js';"
);

// Replace the vcp_ check
ic = ic.replace(
  "if (interaction.user.id !== interaction.guild.ownerId && !isBotOwnerSync(interaction.user.id)) {\n          return interaction.reply({ content: 'Only the Server Owner and Bot Owner can use this panel.', flags: 64 }).catch(()=>{});",
  "if (interaction.user.id !== interaction.guild.ownerId && !isBotOwnerSync(interaction.user.id) && !isExtraOwner(interaction.guild.id, interaction.user.id)) {\n          return interaction.reply({ content: 'Only the Server Owner, Bot Owner, and Extra Owners can use this panel.', flags: 64 }).catch(()=>{});"
);

// Replace the select menu check
ic = ic.replace(
  "if (i.user.id !== i.guild.ownerId && !isBotOwnerSync(i.user.id)) {\n        return i.reply({ content: 'Only the Server Owner and Bot Owner can use this panel.', flags: 64 }).catch(()=>{});",
  "if (i.user.id !== i.guild.ownerId && !isBotOwnerSync(i.user.id) && !isExtraOwner(i.guild.id, i.user.id)) {\n        return i.reply({ content: 'Only the Server Owner, Bot Owner, and Extra Owners can use this panel.', flags: 64 }).catch(()=>{});"
);

fs.writeFileSync("src/events/interactionCreate.js", ic);
console.log("Patched vcpanel extra owner auth + warning!");
