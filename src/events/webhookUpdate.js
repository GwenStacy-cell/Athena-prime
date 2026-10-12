import { AuditLogEvent } from 'discord.js';
import db from '../database.js';
import { directStrike } from '../utils/antinuke.js';

// Wiretap flood tracker: guildId -> [ { timestamp, webhookId, executorId } ]
const webhookEventVelocity = new Map();

export default {
  name: 'webhooksUpdate',
  async execute(channel) {
    if (!channel.guild) return;
    const guild = channel.guild;
    const config = db.getGuildConfig(guild.id);
    if (!config?.securityEnabled && !config?.antiNukeEnabled) return;

    try {
      // 1. Fetch channel's current webhooks
      const webhooks = await channel.fetchWebhooks().catch(() => null);
      if (!webhooks) return;

      const now = Date.now();
      const guildEvents = webhookEventVelocity.get(guild.id) || [];
      const recentEvents = guildEvents.filter(e => now - e.timestamp < 15000);

      // Check if newly created webhooks exceed safe velocity threshold
      const newWebhooks = webhooks.filter(w => now - w.createdTimestamp < 30000);

      for (const [whId, webhook] of newWebhooks) {
        recentEvents.push({ timestamp: now, webhookId: whId, ownerId: webhook.owner?.id });
      }
      webhookEventVelocity.set(guild.id, recentEvents);

      // Flood detection: more than 2 webhooks created within 15 seconds
      if (recentEvents.length >= 2) {
        // Intercept rogue webhooks immediately
        for (const [whId, webhook] of newWebhooks) {
          await webhook.delete('[Athena Sentinel] Webhook Flood Attack Neutralized').catch(() => null);
        }

        // Fire direct antinuke strike to eliminate threat
        await directStrike(
          guild,
          AuditLogEvent.WebhookCreate,
          'Rapid Webhook Flood Attack',
          channel.id,
          async () => 'Deleted rogue flood webhooks'
        );
      }
    } catch (err) {
      console.error('[Antinuke] Webhook Wiretap error:', err);
    }
  }
};
