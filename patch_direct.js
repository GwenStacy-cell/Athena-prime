import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const oldHook = `      if (interaction.customId === 'ytstats_refresh') {
        await interaction.deferReply({ flags: 64 }).catch(() => null);
        const { forceUpdateYtStats } = await import('../utils/ytStatsEngine.js');
        try {
          await forceUpdateYtStats(interaction.guild);
          return interaction.editReply({ content: '-# **Forced refresh complete!** Note: If the name did not change, Discord may be rate-limiting the channel.' }).catch(()=>null);
        } catch (e) {
          return interaction.editReply({ content: \`-# **Refresh failed:** \${e.message}\` }).catch(()=>null);
        }
      }`;

const newHook = `      if (interaction.customId === 'ytstats_refresh') {
        // Use a direct reply to bypass the buggy deferReply prototype
        await interaction.reply({ content: '-# <a:Loading:1537404628826587207> **Force refreshing YouTube Stats...**', flags: 64 }).catch(() => null);
        const { forceUpdateYtStats } = await import('../utils/ytStatsEngine.js');
        try {
          await forceUpdateYtStats(interaction.guild);
          return interaction.editReply({ content: '-# **Forced refresh complete!** Note: If the name did not change, Discord may be rate-limiting the channel.' }).catch(()=>null);
        } catch (e) {
          return interaction.editReply({ content: \`-# **Refresh failed:** \${e.message}\` }).catch(()=>null);
        }
      }`;

js = js.replace(oldHook, newHook);
fs.writeFileSync("src/events/interactionCreate.js", js);
