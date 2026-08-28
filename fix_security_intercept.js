
import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const interceptLogicPrefix = `
        } else if (disable) {
          const config = db.getGuildConfig(message.guild.id);
          if (!config.securityEnabled && !config.antiNukeEnabled) {
            return message.reply(cv2.warn("Security Inactive", "Security is already disabled on this server."));
          }
          
          if (config.twoFactorVerified && config.twoFactorEmail) {
            const code2fa = Math.floor(100000 + Math.random() * 900000).toString();
            db.updateGuildConfig(message.guild.id, { pendingTwoFactorCode: code2fa, pendingAction: "disable_all" });
            
            try {
              const { send2FACode } = await import("../utils/mailer.js");
              await send2FACode(config.twoFactorEmail, code2fa, message.guild.name);
            } catch (err) {
              console.error(err);
            }

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("btn_intercept_2fa").setLabel("Enter 2FA Code").setStyle(ButtonStyle.Danger)
            );
            return message.reply({ content: "?? **Critical Security Action Blocked** ??\\nAn email has been sent to your registered Gmail address. You must verify it to authorize this action.", components: [row] });
          }

          const result = await handleSecurityToggleAll(message.guild, message.member, false);
          await message.reply(result);
        }`;

code = code.replace(/\} else if \(disable\) \{[\s\S]*?await message\.reply\(result\);\s*\}/, interceptLogicPrefix.trim());

const interceptLogicSlash = `
      } else if (disable) {
          const config = db.getGuildConfig(interaction.guild.id);
          if (!config.securityEnabled) {
            return interaction.reply(cv2.warn("Security Inactive", "Security is already disabled on this server."));
          }
          
          if (config.twoFactorVerified && config.twoFactorEmail) {
            const code2fa = Math.floor(100000 + Math.random() * 900000).toString();
            db.updateGuildConfig(interaction.guild.id, { pendingTwoFactorCode: code2fa, pendingAction: "disable_all" });
            
            try {
              const { send2FACode } = await import("../utils/mailer.js");
              await send2FACode(config.twoFactorEmail, code2fa, interaction.guild.name);
            } catch (err) {}

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("btn_intercept_2fa").setLabel("Enter 2FA Code").setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ content: "?? **Critical Security Action Blocked** ??\\nAn email has been sent to your registered Gmail address. You must verify it to authorize this action.", components: [row], ephemeral: true });
          }

          const result = await handleSecurityToggleAll(interaction.guild, interaction.member, false);
          await interaction.reply(result);
        }`;

code = code.replace(/\} else if \(disable\) \{[\s\S]*?await interaction\.reply\(result\);\s*\}/, interceptLogicSlash.trim());

code += `\nexport async function executeInterceptedAction(interaction) {
  const db = (await import("../database.js")).default;
  const config = db.getGuildConfig(interaction.guild.id);
  
  if (config.pendingAction === "disable_all") {
      const result = await handleSecurityToggleAll(interaction.guild, interaction.member, false);
      db.updateGuildConfig(interaction.guild.id, { pendingAction: null });
      return interaction.reply(result);
  }
  return interaction.reply({ content: "No pending action found.", ephemeral: true });
}\n`;

fs.writeFileSync("src/commands/security.js", code);
console.log("Injected security interception");

