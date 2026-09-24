import db from '../database.js';
import { generateGlobalActionCard } from './canvasActionLog.js';

export async function postGlobalActionLog(client, opts) {
  const { action, guildId, guildName, guildIconUrl, targetId, targetTag, executorId, executorTag, reason } = opts;
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = await import('discord.js');

  const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // 1. Generate the Canvas Image
  const attachment = await generateGlobalActionCard({
    action,
    guildName: guildName || 'Unknown Server',
    guildIconUrl,
    targetTag: targetTag || targetId,
    targetId,
    executorName: executorTag || 'Anti-Nuke / Bot',
    executorId,
    reason: reason || 'No reason provided',
    timestamp,
    guildId
  });

  // 2. Build the Embed (The outer box with the gray border)
  const logEmbed = new EmbedBuilder()
    .setColor('#2b2d31') // Invisible/dark gray border
    .setDescription(
      `**GLOBAL ACTION LOG — ${action}**\n\n` +
      `> • **${guildName || 'Unknown Server'}**\n` +
      `> **Target:** <@${targetId}> (\`${targetTag || targetId}\`)\n` +
      `> **Target ID:** \`${targetId}\`\n` +
      `> **Action Taken By:** <@${executorId}> (${executorTag || 'Anti-Nuke / Bot'})\n` +
      `> **Executor ID:** \`${executorId}\``
    )
    .setImage('attachment://action-log.png');

  // 3. Build the Buttons (They will render inside the standard Discord component area beneath the embed)
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open Server').setURL(`https://discord.com/channels/${guildId}`),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Violator ( Human ) : ${targetTag || targetId}`).setURL(`https://discord.com/users/${targetId}`)
  );

  const payload = {
    embeds: [logEmbed],
    files: [attachment],
    components: [row]
  };

  // Broadcast to all guilds with the channel configured
  for (const guild of client.guilds.cache.values()) {
    const cfg = db.getGuildConfig(guild.id);
    if (!cfg?.globalActionLogChannel) continue;
    const channel = guild.channels.cache.get(cfg.globalActionLogChannel);
    if (!channel) continue;
    channel.send(payload).catch(() => null);
  }
}
