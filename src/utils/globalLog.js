import db from '../database.js';
import { generateGlobalActionCard } from './canvasActionLog.js';

export async function postGlobalActionLog(client, opts) {
  const { action, guildId, guildName, guildIconUrl, targetId, targetTag, executorId, executorTag, reason, _isSample } = opts;
  const { MessageFlags, AttachmentBuilder } = await import('discord.js');

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

    // Convert hex accent color to integer for CV2 accent bar
    const hexColor = cfg.accentColor || '#1a1a1f';
    const accentInt = parseInt(hexColor.replace('#', ''), 16);

    // CV2 Container — text + image + buttons all inside ONE box
    const container = {
      type: 17,
      accent_color: accentInt,
      components: [
        {
          type: 10,
          content:
            `**GLOBAL ACTION LOG — ${action}**\n\n` +
            `> **${guildName || 'Unknown Server'}**\n` +
            `> **Target:** <@${targetId}> (\`${targetTag || targetId}\`)\n` +
            `> **Target ID:** \`${targetId}\`\n` +
            `> **Action Taken By:** <@${executorId}> (${executorTag || 'Anti-Nuke / Bot'})\n` +
            `> **Executor ID:** \`${executorId}\``
        },
        { type: 14, divider: true },
        {
          type: 11,
          media: { url: 'attachment://action-log.png' }
        },
        { type: 14, divider: true },
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: 'Open Server', url: `https://discord.com/channels/${guildId}` },
            { type: 2, style: 5, label: `Violator ( Human ) : ${targetTag || targetId}`, url: `https://discord.com/users/${targetId}` }
          ]
        },
        {
          type: 10,
          content: `-# Athena Prime Global Antinuke System • Cross-Server Action Monitor`
        }
      ]
    };

    const payload = {
      files: [attachment],
      components: [container],
      flags: MessageFlags.IsComponentsV2
    };

    channel.send(payload).catch(() => null);
  }
}
