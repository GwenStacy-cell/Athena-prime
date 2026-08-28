import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const oldCode = `    if (customId === "sec_2fa_gmail") {
      return interaction.reply({ content: "Gmail 2FA integration requires connecting to a mailer service. Contact the bot developer to enable this module.", ephemeral: true });
    }`;

const newCode = `    if (customId === "sec_2fa_gmail") {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
      const modal = new ModalBuilder()
        .setCustomId("modal_2fa_setup")
        .setTitle("Configure Gmail 2FA");
      const emailInput = new TextInputBuilder()
        .setCustomId("2fa_email")
        .setLabel("Your Secure Gmail Address")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("admin@gmail.com");
      modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
      return interaction.showModal(modal);
    }`;

code = code.replace(oldCode, newCode);
fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Replaced sec_2fa_gmail!");
