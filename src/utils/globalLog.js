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

  const cleanTarget = String(targetTag || targetId).replace(/[`\[\]\(\)]/g, '').trim();
  const cleanExecutor = String(executorTag || 'Anti-Nuke / Bot').replace(/[`\[\]\(\)]/g, '').trim();

  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setAuthor({
      name: `GLOBAL ACTION LOG — ${action}`,
      iconURL: guildIconUrl || client.user.displayAvatarURL()
    })
    .setDescription(
      `-# **• __Server:__ \`${guildName || 'Unknown Server'}\`**\n` +
      `-# **• __Target:__ [${cleanTarget}](https://discord.com/users/${targetId}) \`(${targetId})\`**\n` +
      `-# **• __Action Taken By:__ [${cleanExecutor}](https://discord.com/users/${executorId}) \`(${executorId})\`**\n` +
      `-# **• __Reason:__ \`${reason || 'No reason provided'}\`**`
    )
    .setImage(`attachment://${attachment.name || 'global_ban_log.png'}`)
    .setFooter({
      text: `Athena Prime Global Antinuke System • Cross-Server Action Monitor • ${timestamp}`
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open Server').setURL(`https://discord.com/channels/${guildId}`),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Violator: ${cleanTarget.substring(0, 60)}`).setURL(`https://discord.com/users/${targetId}`)
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
