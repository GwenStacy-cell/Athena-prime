import fs from "fs";
let code = fs.readFileSync("src/commands/rolemanager.js", "utf8");

// For addrole, removerole, striproles:
// Replace "await interaction.deferReply();" with nothing
code = code.replace(/await interaction\.deferReply\(\);\s*/g, '');

// Replace "interaction.editReply(" with "interaction.reply("
code = code.replace(/interaction\.editReply\(/g, 'interaction.reply(');

fs.writeFileSync("src/commands/rolemanager.js", code);
