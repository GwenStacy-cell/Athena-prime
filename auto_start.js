import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

const oldEnd = `    db.updateGuildConfig(interaction.guild.id, { ytStats });
    return interaction.update(getYtStatsPanel(interaction.guild.id, interaction.client));
  }
}`;

const newEnd = `    db.updateGuildConfig(interaction.guild.id, { ytStats });
    
    // Automatically Force Refresh on Save so the user sees it immediately
    const { forceUpdateYtStats } = await import('../utils/ytStatsEngine.js');
    forceUpdateYtStats(interaction.guild).catch(() => null);

    return interaction.update(getYtStatsPanel(interaction.guild.id, interaction.client));
  }
}`;

js = js.replace(oldEnd, newEnd);
fs.writeFileSync("src/commands/ytstats.js", js);
