import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

const oldCode = `  if (interaction.customId === 'ytstats_refresh') {
    await interaction.deferReply({ flags: 64 }).catch(() => null);
    const { forceUpdateYtStats } = await import('../utils/ytStatsEngine.js');
    try {
      await forceUpdateYtStats(interaction.guild);
      await interaction.editReply({ content: 'Forced refresh complete! Note: If the name did not change, Discord may be rate-limiting the channel.' });
    } catch (e) {
      await interaction.editReply({ content: \`Refresh failed: \${e.message}\` });
    }
  }`;

js = js.replace(oldCode, "");

fs.writeFileSync("src/commands/ytstats.js", js);
