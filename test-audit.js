import dotenv from 'dotenv';
dotenv.config();
import { Client, GatewayIntentBits, AuditLogEvent } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log('Ready!');
  let guild;
  for (const g of client.guilds.cache.values()) {
    try {
      const logs = await g.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberMove });
      if (logs) {
        guild = g;
        break;
      }
    } catch (e) {}
  }

  if (!guild) {
    console.log('No guild with audit log permissions found');
    process.exit(0);
  }

  const logs = await guild.fetchAuditLogs({ limit: 10, type: AuditLogEvent.MemberMove });
  console.log(`Found ${logs.entries.size} logs`);
  logs.entries.forEach(e => {
    console.log(`Log ID: ${e.id}`);
    console.log(`Target: ${e.target?.id} | TargetId: ${e.targetId}`);
    console.log(`Executor: ${e.executor?.id}`);
    console.log(`Extra:`, e.extra);
    console.log('---');
  });

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
