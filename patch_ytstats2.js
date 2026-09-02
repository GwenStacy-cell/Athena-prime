import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

const newLogic = `export async function handleYtStatsModal(interaction) {
  if (interaction.customId === 'ytstats_auto_modal') {
    await interaction.deferReply({ flags: 64 }).catch(()=>null);
    let ytHandle = interaction.fields.getTextInputValue('yt_handle').trim();
    if (ytHandle.includes('youtube.com/')) {
      ytHandle = ytHandle.split('youtube.com/')[1];
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

      const config = (await import('../database.js')).default.getGuildConfig(interaction.guild.id);
      const ytStats = config.ytStats || [];
      
      ytStats.push({ channelId: subsChannel.id, handle: ytHandle, format: '🔴 Subs: {subs}' });
      ytStats.push({ channelId: vidsChannel.id, handle: ytHandle, format: '🎬 Videos: {videos}' });
      
      (await import('../database.js')).default.updateGuildConfig(interaction.guild.id, { ytStats });
      
      const { forceUpdateYtStats } = await import('../utils/ytStatsEngine.js');
      forceUpdateYtStats(interaction.guild).catch(()=>null);
      
      return interaction.editReply({ content: '-# **Auto-Setup Complete!** Created category and channels.' }).catch(()=>null);
    } catch (e) {
      return interaction.editReply({ content: \`-# **Error:** \${e.message}\` }).catch(()=>null);
    }
  }

  if (interaction.customId === 'ytstats_bind_modal') {`;

js = js.replace("export async function handleYtStatsModal(interaction) {\n  if (interaction.customId === 'ytstats_bind_modal') {", newLogic);
fs.writeFileSync("src/commands/ytstats.js", js);
