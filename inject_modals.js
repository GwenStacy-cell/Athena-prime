import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// We need to replace the static reply blocks for sec_wl_user, sec_wl_role, sec_extra_owner, sec_2fa_gmail
const fixModal = `    if (customId === "sec_extra_owner") {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
      const modal = new ModalBuilder().setCustomId("modal_sec_extra_owner").setTitle("Add Extra Owner");
      const input = new TextInputBuilder().setCustomId("target_id").setLabel("User ID to add").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }
    
    if (customId === "sec_wl_user") {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
      const modal = new ModalBuilder().setCustomId("modal_sec_wl_user").setTitle("Whitelist User");
      const input = new TextInputBuilder().setCustomId("target_id").setLabel("User ID to whitelist").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }
    
    if (customId === "sec_wl_role") {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
      const modal = new ModalBuilder().setCustomId("modal_sec_wl_role").setTitle("Whitelist Role");
      const input = new TextInputBuilder().setCustomId("target_id").setLabel("Role ID to whitelist").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (customId === "sec_2fa_gmail") {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
      const modal = new ModalBuilder().setCustomId("modal_2fa_setup").setTitle("Configure Gmail 2FA");
      const emailInput = new TextInputBuilder().setCustomId("2fa_email").setLabel("Your Secure Gmail Address").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("admin@gmail.com");
      modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
      return interaction.showModal(modal);
    }`;

// Since the old code is multiline and regex might fail, I'll use indexOf
const start = code.indexOf('if (customId === "sec_extra_owner") {');
const end = code.indexOf('if (customId === \'sec_close\') {');

if (start !== -1 && end !== -1) {
    code = code.substring(0, start) + fixModal + "\n\n    " + code.substring(end);
} else {
    console.log("Could not find the button handlers block!");
}

// Now we need to add the Modal submit handlers for these new modals!
const modalHandlers = `
      if (interaction.customId === "modal_sec_extra_owner") {
          const targetId = interaction.fields.getTextInputValue("target_id");
          const { handleExtraOwner } = await import("../commands/extraowner.js");
          const result = await handleExtraOwner(interaction.guild, interaction.member, "add", targetId);
          return interaction.reply(result);
      }
      if (interaction.customId === "modal_sec_wl_user") {
          const targetId = interaction.fields.getTextInputValue("target_id");
          const { handleWhitelist } = await import("../commands/whitelist.js");
          const result = await handleWhitelist(interaction.guild, interaction.member, "add", targetId);
          return interaction.reply(result);
      }
      if (interaction.customId === "modal_sec_wl_role") {
          const targetId = interaction.fields.getTextInputValue("target_id");
          const db = (await import("../database.js")).default;
          if (db.addWhitelistedRole) {
              db.addWhitelistedRole(interaction.guild.id, targetId);
              return interaction.reply({ content: \`Successfully whitelisted role ID: \${targetId}\`, ephemeral: true });
          } else {
              return interaction.reply({ content: \`Role whitelisting is not supported in the database yet.\`, ephemeral: true });
          }
      }
`;

const modalInsertPoint = code.indexOf('if (interaction.customId === "modal_2fa_setup") {');
if (modalInsertPoint !== -1) {
    code = code.substring(0, modalInsertPoint) + modalHandlers + code.substring(modalInsertPoint);
}

fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Injected Modals for Dashboard buttons!");
