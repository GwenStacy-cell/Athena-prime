import { isAuthorized } from './helpers.js';
import db from '../database.js';

const DESTRUCTIVE_EVENTS = new Set([
  'CHANNEL_DELETE',
  'CHANNEL_CREATE',
  'GUILD_ROLE_DELETE',
  'GUILD_ROLE_CREATE',
  'GUILD_BAN_ADD'
]);

export function attachWiretap(client) {
  client.ws.on('RAW', async (packet) => {
    if (!packet.t || !DESTRUCTIVE_EVENTS.has(packet.t)) return;

    const guildId = packet.d.guild_id;
    if (!guildId) return;

    const config = db.getGuildConfig(guildId);
    if (!config || (!config.securityEnabled && !config.antiNukeEnabled)) return;

    // Fast map event to AuditLog action type
    let actionType = 0;
    if (packet.t === 'CHANNEL_DELETE') actionType = 12;
    else if (packet.t === 'CHANNEL_CREATE') actionType = 10;
    else if (packet.t === 'GUILD_ROLE_DELETE') actionType = 32;
    else if (packet.t === 'GUILD_ROLE_CREATE') actionType = 30;
    else if (packet.t === 'GUILD_BAN_ADD') actionType = 22;

    try {
      // 1. Instantly fetch the latest audit log via RAW HTTP (bypassing djs queues)
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/audit-logs?action_type=${actionType}&limit=1`, {
        headers: { 'Authorization': `Bot ${client.token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      
      if (!data.audit_log_entries || data.audit_log_entries.length === 0) return;
      const entry = data.audit_log_entries[0];
      
      const executorId = entry.user_id;
      if (!executorId || executorId === client.user.id) return;
      
      // We need the guild object to check authorization (Server Owner, Extra Owners)
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;

      // Mock an executor object for isAuthorized
      const executorMock = { id: executorId };

      if (!isAuthorized(guild, executorMock)) {
        // 2. Instantly ban the unauthorized user via RAW HTTP (Zero-Day Fast Path)
        await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${executorId}`, {
          method: 'PUT',
          headers: { 
            'Authorization': `Bot ${client.token}`,
            'X-Audit-Log-Reason': 'Athena Wiretap: ZERO-DAY INSTANT BAN (Raw Websocket Intercept)'
          },
          body: JSON.stringify({ delete_message_seconds: 0 })
        });
        
        console.log(`[ATHENA WIRETAP] ⚡ RAW Socket Intercepted ${packet.t}! Banned ${executorId} in <1ms!`);
      }

    } catch (e) {
      // Silently fail to let the normal discord.js directStrike handle it
    }
  });
}
