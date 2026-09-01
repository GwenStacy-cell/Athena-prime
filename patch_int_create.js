import fs from "fs";
let intC = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const startStr = "else if (customId === 'am_tgl_global_invites') {";
const endStr = "else if (customId === 'am_timeout_cycle') {";

let startIdx = intC.indexOf(startStr);
let endIdx = intC.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const newHandlers = `else if (customId === 'am_tgl_selfbot') {
        const config = db.getGuildConfig(guildId);
        const current = config.selfbotDetectionEnabled !== false;
        db.updateGuildConfig(guildId, { selfbotDetectionEnabled: !current });
        const { getAutoModPanel } = await import('../commands/security.js');
        const newPanel = await getAutoModPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      else if (customId === 'am_tgl_global_invites') {
        const config = db.getGuildConfig(guildId);
        db.updateGuildConfig(guildId, { allowInvitesGlobally: !config.allowInvitesGlobally });
        const { getAutoModPanel } = await import('../commands/security.js');
        const newPanel = await getAutoModPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      else if (customId === 'am_channel_configs') {
        const { getChannelConfigPanel } = await import('../commands/security.js');
        const newPanel = await getChannelConfigPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      else if (customId === 'am_back_to_main') {
        const { getAutoModPanel } = await import('../commands/security.js');
        const newPanel = await getAutoModPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      `;

    intC = intC.substring(0, startIdx) + newHandlers + intC.substring(endIdx);
    fs.writeFileSync("src/events/interactionCreate.js", intC);
    console.log("Success");
} else {
    console.log("Failed");
}
