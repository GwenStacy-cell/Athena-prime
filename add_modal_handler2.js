import fs from "fs";

let text = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const injection = `
      if (interaction.customId.startsWith('modal_honeypot_')) {
        const channelId = interaction.customId.replace('modal_honeypot_', '');
        const bannerUrl = interaction.fields.getTextInputValue('banner_url') || null;
        
        const db = (await import('../database.js')).default;
        db.updateGuildConfig(interaction.guild.id, { honeypotChannelId: channelId });
        
        const config = db.getGuildConfig(interaction.guild.id);
        const timeoutMinutes = config.honeypotTimeoutMinutes || 15;
        
        const { getAutoModPanel } = await import('../commands/security.js');
        const panel = await getAutoModPanel(interaction.guild);
        
        await interaction.update(panel).catch(() => null);
        
        const trapChannel = interaction.guild.channels.cache.get(channelId);
        if (trapChannel) {
          const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, EmbedBuilder, MessageFlags } = await import('discord.js');
          
          const container = new ContainerBuilder();
          
          const header = new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(\`**Athena | Note**\`));
            
          container.addSectionComponents(header);
          
          const trapText = "-# **This is trap channel don't send any \\`messages\\` here \\`" + timeoutMinutes + " minutes timeout will happen\\` if you send any \\`fucking messages\\` here**";
          container.addTextDisplayComponents(new TextDisplayBuilder().setContent(trapText));
          
          const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
          
          if (bannerUrl) {
            const embed = new EmbedBuilder().setImage(bannerUrl).setColor(config.accentColor || 0x2b2d31);
            payload.embeds = [embed];
          }
          
          trapChannel.send(payload).catch(() => null);
        }
        return;
      }
`;

text = text.replace(
    "if (interaction.customId === 'accent_modal') {",
    injection + "\n        if (interaction.customId === 'accent_modal') {"
);

fs.writeFileSync("src/events/interactionCreate.js", text);
