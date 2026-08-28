import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// Change await send2FACode to run in background and immediately show the button
const oldBlock = `          try {
            const { send2FACode } = await import("../utils/mailer.js");
            await send2FACode(email, code2fa, interaction.guild.name);
            
            const db = (await import("../database.js")).default;
            db.updateGuildConfig(interaction.guild.id, {
              twoFactorEmail: email,
              pendingTwoFactorCode: code2fa,
              twoFactorVerified: false
            });
            
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("btn_verify_gmail").setLabel("Enter 2FA Code").setStyle(ButtonStyle.Success)
            );
            return interaction.editReply({ content: "A verification code has been sent to **" + email + "**. Click below to enter it.", components: [row] });
          } catch (err) {
            return interaction.editReply({ content: "Failed to send email: " + err.message });
          }`;

const newBlock = `          try {
            const { send2FACode } = await import("../utils/mailer.js");
            
            // Send in background so host timeout doesn't softlock the UI
            send2FACode(email, code2fa, interaction.guild.name).catch(err => console.error("SMTP Error:", err.message));
            
            const db = (await import("../database.js")).default;
            db.updateGuildConfig(interaction.guild.id, {
              twoFactorEmail: email,
              pendingTwoFactorCode: code2fa,
              twoFactorVerified: false
            });
            
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("btn_verify_gmail").setLabel("Enter 2FA Code").setStyle(ButtonStyle.Success)
            );
            return interaction.editReply({ content: "A verification code has been dispatched to **" + email + "** (Check your Pterodactyl console if it doesn't arrive). Click below to enter it.", components: [row] });
          } catch (err) {
            return interaction.editReply({ content: "Failed to initialize 2FA: " + err.message });
          }`;

code = code.replace(oldBlock, newBlock);
fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Fixed 2FA modal softlock!");
