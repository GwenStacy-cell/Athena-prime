import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// Fix btn_app_apply
js = js.replace(
  "import('../database.js').then(db => {",
  "import('../database.js').then(async db => {"
);
js = js.replace(
  "const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');\n        const modal = new ModalBuilder().setCustomId('modal_app_submit').setTitle('Staff Application');",
  "const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');\n        const modal = new ModalBuilder().setCustomId('modal_app_submit').setTitle('Staff Application');"
);

// Fix btn_app_review_*
js = js.replace(
  "const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');\n      const action = interaction.customId.split('_')[3];",
  "import('discord.js').then(({ ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder }) => {\n      const action = interaction.customId.split('_')[3];"
);
js = js.replace(
  "interaction.showModal(modal).catch(console.error);\n      return;",
  "interaction.showModal(modal).catch(console.error);\n      });\n      return;"
);

// Fix modal_app_submit
js = js.replace(
  "const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');",
  "const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = await import('discord.js');"
);

// Fix modal_app_review_
js = js.replace(
  "const { MessageFlags } = require('discord.js');",
  "const { MessageFlags } = await import('discord.js');"
);

// Fix btn_verify_honeypot
js = js.replace(
  "const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');",
  "import('discord.js').then(({ ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder }) => {"
);
js = js.replace(
  "modal.addComponents(new ActionRowBuilder().addComponents(inputMax));\n        \n        interaction.showModal(modal).catch(console.error);\n      });\n      return;",
  "modal.addComponents(new ActionRowBuilder().addComponents(inputMax));\n        \n        interaction.showModal(modal).catch(console.error);\n      });\n      });\n      return;"
);

fs.writeFileSync("src/events/interactionCreate.js", js);
