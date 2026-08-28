
import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const oldLogic = `if (customId === "sec_2fa_gmail") {
      return interaction.reply({ content: "Gmail 2FA integration requires connecting to a mailer service. Contact the bot developer to enable this module.", ephemeral: true });
    }`;

const newLogic = `if (customId === "sec_2fa_gmail") {
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

code = code.replace(oldLogic, newLogic);

const modalHandlers = `
  if (interaction.isButton() && interaction.customId === "btn_verify_2fa") {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
      const modal = new ModalBuilder()
        .setCustomId("modal_2fa_verify")
        .setTitle("Verify 2FA Code");
      const codeInput = new TextInputBuilder()
        .setCustomId("2fa_code")
        .setLabel("6-Digit Code")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
      return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    if (customId === "modal_2fa_setup") {
      const email = interaction.fields.getTextInputValue("2fa_email");
      if (!email.includes("@")) return interaction.reply({ content: "Invalid email format.", ephemeral: true });
      
      const code2fa = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
      
      await interaction.deferReply({ ephemeral: true });
      try {
        const { send2FACode } = await import("../utils/mailer.js");
        await send2FACode(email, code2fa, interaction.guild.name);
        
        const db = (await import("../database.js")).default;
        db.updateGuildConfig(interaction.guild.id, {
          twoFactorEmail: email,
          pendingTwoFactorCode: code2fa,
          twoFactorVerified: false
        });

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("btn_verify_2fa").setLabel("Verify Code").setStyle(ButtonStyle.Success)
        );
        return interaction.editReply({ content: "A verification code has been sent to **" + email + "**. Click below to enter it.", components: [row] });
      } catch (err) {
        return interaction.editReply({ content: "Failed to send email: " + err.message });
      }
    }
    
    if (customId === "modal_2fa_verify") {
      const inputCode = interaction.fields.getTextInputValue("2fa_code");
      const db = (await import("../database.js")).default;
      const config = db.getGuildConfig(interaction.guild.id);
      
      if (config.pendingTwoFactorCode && config.pendingTwoFactorCode === inputCode) {
        db.updateGuildConfig(interaction.guild.id, {
          twoFactorVerified: true,
          pendingTwoFactorCode: null
        });
        
        const sec = await import("../commands/security.js");
        const panel = await sec.getSecureDashboardPanel(interaction.guild);
        
        await interaction.reply({ content: "? **Gmail 2FA Successfully Configured!** Your server is now heavily protected.", ephemeral: true });
        
        if (interaction.message && interaction.message.reference) {
            // Need to edit original dash if possible, but ephemeral reply covers it.
        }
        return;
      } else {
        return interaction.reply({ content: "? Incorrect verification code.", ephemeral: true });
      }
    }
  }
`;

code += "\n" + modalHandlers;
fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Injected 2FA modal handlers");

