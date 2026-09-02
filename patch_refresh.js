import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

const oldLogic = `  if (interaction.customId === 'ytstats_refresh') {
    const { forceUpdateYtStats } = await import('../utils/ytStatsEngine.js');
    await interaction.deferReply({ ephemeral: true });
    try {`;

const newLogic = `  if (interaction.customId === 'ytstats_refresh') {
    await interaction.deferReply({ flags: 64 }).catch(() => null);
    const { forceUpdateYtStats } = await import('../utils/ytStatsEngine.js');
    try {`;

js = js.replace(oldLogic, newLogic);
fs.writeFileSync("src/commands/ytstats.js", js);
