import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const oldHook = `      if (interaction.customId.startsWith('ytstats_')) {
        const { handleYtStatsButton } = await import('../commands/ytstats.js');
        if (interaction.isButton()) return handleYtStatsButton(interaction);
      }`;

const newHook = `      if (interaction.customId === 'ytstats_refresh') {
        await interaction.deferReply({ flags: 64 }).catch(() => null);
        const { forceUpdateYtStats } = await import('../utils/ytStatsEngine.js');
        try {
          await forceUpdateYtStats(interaction.guild);
          return interaction.editReply({ content: '-# **Forced refresh complete!** Note: If the name did not change, Discord may be rate-limiting the channel.' }).catch(()=>null);
        } catch (e) {
          return interaction.editReply({ content: \`-# **Refresh failed:** \${e.message}\` }).catch(()=>null);
        }
      }
      if (interaction.customId.startsWith('ytstats_')) {
        const { handleYtStatsButton } = await import('../commands/ytstats.js');
        if (interaction.isButton()) return handleYtStatsButton(interaction);
      }`;

js = js.replace(oldHook, newHook);
fs.writeFileSync("src/events/interactionCreate.js", js);
