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

  const card = {
    type: 17,
    components: [
      { type: 10, content: `## **GLOBAL ACTION LOG — ${action}**` },
      { type: 14, divider: true },
      { type: 10, content: `**Server:** **${guildName || 'Unknown Server'}**\n**Target:** [${cleanTarget}](https://discord.com/users/${targetId}) \`(${targetId})\`\n**Action Taken By:** [${cleanExecutor}](https://discord.com/users/${executorId}) \`(${executorId})\`\n**Reason:** ${reason || 'No reason provided'}` },
      { type: 14, divider: true },
      { type: 10, content: `*Athena Prime Global Antinuke System • Cross-Server Action Monitor • ${timestamp}*` },
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: 'Open Server', url: `https://discord.com/channels/${guildId}` },
          { type: 2, style: 5, label: `Violator: ${cleanTarget.substring(0, 60)}`, url: `https://discord.com/users/${targetId}` }
        ]
      }
    ]
  };

  const payload = { components: [card], files: [attachment], flags: 32768 };

  for (const guild of client.guilds.cache.values()) {
    const cfg = db.getGuildConfig(guild.id);
    if (!cfg?.globalActionLogChannel) continue;
    const channel = guild.channels.cache.get(cfg.globalActionLogChannel);
    if (!channel) continue;
    channel.send(payload).catch(() => null);
  }
}
