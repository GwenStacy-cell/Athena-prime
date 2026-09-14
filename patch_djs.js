import fs from "fs";

// Fix rolemanager.js
let rm = fs.readFileSync("src/commands/rolemanager.js", "utf8");
rm = rm.replace("statusMessage = await context.fetchReply();", "");
rm = rm.replace("await context.reply(initialReply);", "statusMessage = await context.reply({ ...initialReply, withResponse: true });");
fs.writeFileSync("src/commands/rolemanager.js", rm);

// Fix utility.js (help command)
let ut = fs.readFileSync("src/commands/utility.js", "utf8");
ut = ut.replace("reply = await interaction.fetchReply();", "");
ut = ut.replace("await interaction.reply({ components: [components], flags: MessageFlags.IsComponentsV2 });", "reply = await interaction.reply({ components: [components], flags: MessageFlags.IsComponentsV2, withResponse: true });");

// Fix utility.js (ping command)
ut = ut.replace("const sent = await interaction.fetchReply();", "");
ut = ut.replace("await interaction.reply({ content: 'Calculating ping...' });", "const sent = await interaction.reply({ content: 'Calculating ping...', withResponse: true });");
fs.writeFileSync("src/commands/utility.js", ut);

console.log("Patched fetchReply!");
