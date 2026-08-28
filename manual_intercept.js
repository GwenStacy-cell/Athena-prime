
import fs from "fs";

let code = fs.readFileSync("src/commands/security.js", "utf8");

// Split by "} else if (disable) {"
const parts = code.split("} else if (disable) {");

if (parts.length === 3) {
    // 0 is before prefix, 1 is inside prefix, 2 is inside slash
    
    // We want to replace everything from the start of parts[1] up to "await message.reply(result);"
    // and replace everything from the start of parts[2] up to "await interaction.reply(result);"
    
    const prefixBlock = `
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
          } catch (err) {}

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("btn_intercept_2fa").setLabel("Enter 2FA Code").setStyle(ButtonStyle.Danger)
          );
          return message.reply({ content: "?? **Critical Security Action Blocked** ??\\nAn email has been sent to your registered Gmail address. You must verify it to authorize this action.", components: [row] });
        }

        const result = await handleSecurityToggleAll(message.guild, message.member, false);
        await message.reply(result);
    `;

    const slashBlock = `
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
    `;

    const p1EndIdx = parts[1].indexOf("await message.reply(result);") + "await message.reply(result);".length;
    const p1Tail = parts[1].substring(p1EndIdx);
    
    const p2EndIdx = parts[2].indexOf("await interaction.reply(result);") + "await interaction.reply(result);".length;
    const p2Tail = parts[2].substring(p2EndIdx);

    let finalCode = parts[0] + "} else if (disable) {" + prefixBlock + p1Tail + "} else if (disable) {" + slashBlock + p2Tail;

    finalCode += `\nexport async function executeInterceptedAction(interaction) {
  const db = (await import("../database.js")).default;
  const config = db.getGuildConfig(interaction.guild.id);
  
  if (config.pendingAction === "disable_all") {
      const result = await handleSecurityToggleAll(interaction.guild, interaction.member, false);
      db.updateGuildConfig(interaction.guild.id, { pendingAction: null });
      return interaction.reply(result);
  }
  return interaction.reply({ content: "No pending action found.", ephemeral: true });
}\n`;

    fs.writeFileSync("src/commands/security.js", finalCode);
    console.log("Success");
} else {
    console.log("Parts:", parts.length);
}

