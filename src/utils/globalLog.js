import db from '../database.js';
import { generateGlobalActionCard } from './canvasActionLog.js';

export async function postGlobalActionLog(client, opts) {
  const { action, guildId, guildName, guildIconUrl, targetId, targetTag, executorId, executorTag, reason, _isSample } = opts;
  const { MessageFlags } = await import('discord.js');

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

  // Borderless CV2 container (no accent_color = no left stripe)
  const container = {
    type: 17,
    components: [
      {
        type: 10,
        content: `## GLOBAL ACTION LOG — ${action}`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: [
          `**${guildName || 'Unknown Server'}**`,
          `**Target:** <@${targetId}> (\`${targetTag || targetId}\`)`,
          `**Target ID:** \`${targetId}\``,
          `**Action Taken By:** <@${executorId}> (${executorTag || 'Anti-Nuke / Bot'})`,
          `**Executor ID:** \`${executorId}\``,
          `**Reason:** ${reason || 'No reason provided'}`,
        ].join('\n')
      },
      { type: 14, divider: true },
      {
        type: 9,
        components: [{ type: 10, content: '\u200B' }],
        accessory: { type: 11, media: { url: 'attachment://action-log.png' } }
      },
      { type: 14, divider: true },
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: 'Open Server', url: `https://discord.com/channels/${guildId}` },
          { type: 2, style: 5, label: `Violator: ${(targetTag || targetId).substring(0, 60)}`, url: `https://discord.com/users/${targetId}` }
        ]
      },
      {
        type: 10,
        content: `-# **Athena Prime Global Antinuke System • Cross-Server Action Monitor** · ${timestamp}`
      }
    ]
  };

  const payload = { components: [container], files: [attachment], flags: MessageFlags.IsComponentsV2 };

  // Broadcast to every guild that has a globalActionLogChannel set
  for (const guild of client.guilds.cache.values()) {
    const cfg = db.getGuildConfig(guild.id);
    if (!cfg?.globalActionLogChannel) continue;
    const channel = guild.channels.cache.get(cfg.globalActionLogChannel);
    if (!channel) continue;

    channel.send(payload).catch(() => null);
  }
}
