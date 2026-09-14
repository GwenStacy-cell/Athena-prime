import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// Fix the vcp_ check
js = js.replace(/if\s*\(interaction\.user\.id !== interaction\.guild\.ownerId && !isBotOwnerSync\(interaction\.user\.id\)\)\s*\{\s*return interaction\.reply\(\{ content: 'Only the Server Owner and Bot Owner can use this panel\.', flags: 64 \}\)\.catch\(\(\)=>\{\}\);\s*\}/g,
"if (interaction.user.id !== interaction.guild.ownerId && !isBotOwnerSync(interaction.user.id) && !isExtraOwner(interaction.guild.id, interaction.user.id)) {\n          return interaction.reply({ content: 'Only the Server Owner, Bot Owner, and Extra Owners can use this panel.', flags: 64 }).catch(()=>{});\n        }");

// Fix the vcp_select check
js = js.replace(/if\s*\(i\.user\.id !== i\.guild\.ownerId && !isBotOwnerSync\(i\.user\.id\)\)\s*\{\s*return i\.reply\(\{ content: 'Only the Server Owner and Bot Owner can use this panel\.', flags: 64 \}\)\.catch\(\(\)=>\{\}\);\s*\}/g,
"if (i.user.id !== i.guild.ownerId && !isBotOwnerSync(i.user.id) && !isExtraOwner(i.guild.id, i.user.id)) {\n        return i.reply({ content: 'Only the Server Owner, Bot Owner, and Extra Owners can use this panel.', flags: 64 }).catch(()=>{});\n      }");

// Add isExtraOwner to imports if not there
if (js.includes("import { isBotOwnerSync } from '../utils/helpers.js';")) {
  js = js.replace("import { isBotOwnerSync } from '../utils/helpers.js';", "import { isBotOwnerSync, isExtraOwner } from '../utils/helpers.js';");
}

fs.writeFileSync("src/events/interactionCreate.js", js);
console.log("Patched interactionCreate.js extra owner auth!");
