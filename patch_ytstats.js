import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

// Update the auto-setup modal handler to include Views
const oldCode = `      const vidsChannel = await interaction.guild.channels.create({
        name: '🎬 Videos: Loading...',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.Connect] }]
      });

      const db = (await import('../database.js')).default;
      const config = db.getGuildConfig(interaction.guild.id);
      const ytStats = config.ytStats || [];
      
      ytStats.push({ channelId: subsChannel.id, handle: ytHandle, format: '🔴 Subs: {subs}' });
      ytStats.push({ channelId: vidsChannel.id, handle: ytHandle, format: '🎬 Videos: {videos}' });`;

const newCode = `      const vidsChannel = await interaction.guild.channels.create({
        name: '🎬 Videos: Loading...',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.Connect] }]
      });

      const viewsChannel = await interaction.guild.channels.create({
        name: '👀 Views: Loading...',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.Connect] }]
      });

      const db = (await import('../database.js')).default;
      const config = db.getGuildConfig(interaction.guild.id);
      const ytStats = config.ytStats || [];
      
      ytStats.push({ channelId: subsChannel.id, handle: ytHandle, format: '🔴 Subs: {subs}' });
      ytStats.push({ channelId: vidsChannel.id, handle: ytHandle, format: '🎬 Videos: {videos}' });
      ytStats.push({ channelId: viewsChannel.id, handle: ytHandle, format: '👀 Views: {views}' });`;

js = js.replace(oldCode, newCode);

// Update Dashboard documentation
js = js.replace(
  "Use `{subs}` and `{videos}` where you want the numbers to appear",
  "Use `{subs}`, `{videos}`, and `{views}` where you want the numbers to appear"
);

fs.writeFileSync("src/commands/ytstats.js", js);
