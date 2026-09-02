import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

const oldLogic = "export async function handleYtStatsModal(interaction) {";
const newLogic = `export async function handleYtStatsModal(interaction) {
  if (interaction.customId === 'ytstats_auto_modal') {
    await interaction.reply({ content: '-# <a:Loading:1537404628826587207> **Building YouTube Layout...**', flags: 64 }).catch(()=>null);
    let ytHandle = interaction.fields.getTextInputValue('yt_handle').trim();
    if (ytHandle.includes('youtube.com/')) {
      const parts = ytHandle.split('youtube.com/');
      ytHandle = parts[1];
    }
    ytHandle = ytHandle.split('?')[0].replace(/[\\/]/g, '').trim();
    if (!ytHandle.startsWith('@') && !ytHandle.startsWith('UC')) ytHandle = '@' + ytHandle;

    try {
      const { ChannelType, PermissionFlagsBits } = await import('discord.js');
      const category = await interaction.guild.channels.create({
        name: \`▶ \${ytHandle}\`,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.Connect] }]
      });

      const subsChannel = await interaction.guild.channels.create({
        name: '🔴 Subs: Loading...',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.Connect] }]
      });

      const vidsChannel = await interaction.guild.channels.create({
        name: '🎬 Videos: Loading...',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.Connect] }]
      });

      const db = (await import('../database.js')).default;
      const config = db.getGuildConfig(interaction.guild.id);
      const ytStats = config.ytStats || [];
      
      ytStats.push({ channelId: subsChannel.id, handle: ytHandle, format: '🔴 Subs: {subs}' });
      ytStats.push({ channelId: vidsChannel.id, handle: ytHandle, format: '🎬 Videos: {videos}' });
      
      db.updateGuildConfig(interaction.guild.id, { ytStats });
      
      const { forceUpdateYtStats } = await import('../utils/ytStatsEngine.js');
      forceUpdateYtStats(interaction.guild).catch(()=>null);
      
      return interaction.editReply({ content: '-# **Auto-Setup Complete!** Category and Channels created seamlessly.' }).catch(()=>null);
    } catch (e) {
      return interaction.editReply({ content: \`-# **Error:** \${e.message}\` }).catch(()=>null);
    }
  }`;

js = js.replace(oldLogic, newLogic);
fs.writeFileSync("src/commands/ytstats.js", js);
