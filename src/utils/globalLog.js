import db from '../database.js';
import { generateGlobalActionCard } from './canvasActionLog.js';

export async function postGlobalActionLog(client, opts) {
  const { action, guildId, guildName, guildIconUrl, targetId, targetTag, executorId, executorTag, reason, _isSample } = opts;
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');

  if (targetId === client.user.id && !_isSample) return;

  const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

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

  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle(`GLOBAL ACTION LOG \u2014 ${action}`)
    .setDescription([
      `**${guildName || 'Unknown Server'}**`,
      `**Target:** ${targetTag || 'Unknown User'}`,
      `**Target ID:** [${targetId}](https://discord.com/users/${targetId})`,
      `**Action Taken By:** ${executorTag || 'Anti-Nuke / Bot'}`,
      `**Executor ID:** [${executorId}](https://discord.com/users/${executorId})`,
      `**Reason:** ${reason || 'No reason provided'}`,
    ].join('\n'))
    .setImage(`attachment://${attachment.name}`)
    .setFooter({ text: `Athena Prime Global Antinuke System \u2022 Cross-Server Action Monitor \u2022 ${timestamp}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open Server').setURL(`https://discord.com/channels/${guildId}`),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Violator: ${(targetTag || targetId).substring(0, 60)}`).setURL(`https://discord.com/users/${targetId}`)
  );

  const payload = { embeds: [embed], components: [row], files: [attachment], _skipCV2: true };

  for (const guild of client.guilds.cache.values()) {
    const cfg = db.getGuildConfig(guild.id);
    if (!cfg?.globalActionLogChannel) continue;
    const channel = guild.channels.cache.get(cfg.globalActionLogChannel);
    if (!channel) continue;
    channel.send(payload).catch(() => null);
  }
}
