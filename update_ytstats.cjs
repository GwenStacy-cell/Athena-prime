const fs = require('fs');
let code = fs.readFileSync('src/commands/ytstats.js', 'utf8');

// 1. Rename button
code = code.replace(".setLabel('Auto-Setup Channels')", ".setLabel('Add YouTube Channel')");

// 2. Fix Wipe All Configs logic
const clearBlockOld = 
  if (interaction.customId === 'ytstats_clear') {
    db.updateGuildConfig(interaction.guild.id, { ytStats: [] });
    return interaction.update(getYtStatsPanel(interaction.guild.id, interaction.client));
  }
;

const clearBlockNew = 
  if (interaction.customId === 'ytstats_clear') {
    await interaction.deferUpdate();
    const config = db.getGuildConfig(interaction.guild.id) || {};
    const ytStats = config.ytStats || [];
    
    const categoriesToDelete = new Set();
    for (const stat of ytStats) {
      const channel = interaction.guild.channels.cache.get(stat.channelId);
      if (channel) {
        if (channel.parentId) categoriesToDelete.add(channel.parentId);
        await channel.delete().catch(() => null);
      }
    }
    
    for (const catId of categoriesToDelete) {
      const category = interaction.guild.channels.cache.get(catId);
      if (category && category.name.includes('▶')) {
        await category.delete().catch(() => null);
      }
    }
    
    db.updateGuildConfig(interaction.guild.id, { ytStats: [] });
    return interaction.editReply(getYtStatsPanel(interaction.guild.id, interaction.client));
  }
;

code = code.replace(clearBlockOld.trim(), clearBlockNew.trim());
fs.writeFileSync('src/commands/ytstats.js', code);
