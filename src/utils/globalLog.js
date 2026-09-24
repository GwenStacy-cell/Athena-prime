import db from '../database.js';
import { generateGlobalActionCard } from './canvasActionLog.js';

export async function postGlobalActionLog(client, opts) {
  const { action, guildId, guildName, guildIconUrl, targetId, targetTag, executorId, executorTag, reason, _isSample } = opts;
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = await import('discord.js');

  // Athena never punishes itself — skip if target is the bot (unless it's a sample preview)
  if (targetId === client.user.id && !_isSample) return;

  const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Generate the Canvas Image
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
  }).catch(() => null);

  if (!attachment) return;

  // Broadcast to every guild that has a globalActionLogChannel set
  for (const guild of client.guilds.cache.values()) {
    const cfg = db.getGuildConfig(guild.id);
    if (!cfg?.globalActionLogChannel) continue;
    const channel = guild.channels.cache.get(cfg.globalActionLogChannel);
    if (!channel) continue;

    // Accent-borderless: use the guild's saved accent color so the embed border blends with the card
    const accentColor = cfg.accentColor || '#1a1a1f';

    const logEmbed = new EmbedBuilder()
      .setColor(accentColor)
      .setDescription(
        `**GLOBAL ACTION LOG — ${action}**\n\n` +
        `> **${guildName || 'Unknown Server'}**\n` +
        `> **Target:** <@${targetId}> (\`${targetTag || targetId}\`)\n` +
        `> **Target ID:** \`${targetId}\`\n` +
        `> **Action Taken By:** <@${executorId}> (${executorTag || 'Anti-Nuke / Bot'})\n` +
        `> **Executor ID:** \`${executorId}\``
      )
      .setImage('attachment://action-log.png')
      .setFooter({ text: 'Athena Prime Global Antinuke System • Cross-Server Action Monitor' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open Server').setURL(`https://discord.com/channels/${guildId}`),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Violator ( Human ) : ${targetTag || targetId}`).setURL(`https://discord.com/users/${targetId}`)
    );

    channel.send({ embeds: [logEmbed], files: [attachment], components: [row] }).catch(() => null);
  }
}
