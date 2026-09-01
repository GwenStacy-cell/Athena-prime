import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

// Fix initial prefix reply
const oldPrefixInit = "const sent = await message.reply({ content: 'Calculating ping...' });";
const newPrefixInit = `const { MessageFlags } = await import('discord.js');
        const sent = await message.reply({ 
          components: [{ type: 17, components: [{ type: 10, content: '-# **Calculating ping...**' }] }],
          flags: MessageFlags.IsComponentsV2 
        });`;
code = code.replace(oldPrefixInit, newPrefixInit);

// Fix initial slash reply
const oldSlashInit = "await interaction.reply({ content: 'Calculating ping...' });";
const newSlashInit = `const { MessageFlags } = await import('discord.js');
        await interaction.reply({ 
          components: [{ type: 17, components: [{ type: 10, content: '-# **Calculating ping...**' }] }],
          flags: MessageFlags.IsComponentsV2 
        });`;
code = code.replace(oldSlashInit, newSlashInit);

fs.writeFileSync("src/commands/utility.js", code);
