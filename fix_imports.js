import fs from 'fs';
let code = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

code = code.replace(
  "import { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';",
  "import { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';"
);

// We should also make sure gw_manage_select handles safely in the main block.
// Is gw_manage_select caught in the root condition?
// interaction.customId.startsWith('gw_manage_') will catch 'gw_manage_select'!

fs.writeFileSync('src/events/interactionCreate.js', code);
console.log("Fixed imports");
