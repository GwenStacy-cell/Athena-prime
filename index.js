import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import chalk from 'chalk';
import http from 'http';

// Load Environment Variables
dotenv.config();

// Print boot header
console.log(chalk.hex('#FFD700').bold('\n============================================='));
console.log(chalk.hex('#FFD700').bold('🛡️   Athena Prime - Initializing...   🛡️'));
console.log(chalk.hex('#FFD700').bold('=============================================\n'));

const token = process.env.DISCORD_TOKEN;
if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error(chalk.red.bold('❌ ERROR: Discord token is missing in .env file!'));
  console.error(chalk.yellow('Please configure your bot token inside: ') + chalk.bold('c:\\Users\\hathi\\OneDrive\\Desktop\\new bot\\.env'));
  process.exit(1);
}

// Construct Client with proper Privileged Intents and Partials
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,        // Privileged Intent
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,      // Privileged Intent
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,      // Privileged Intent (for owner status detection)
    GatewayIntentBits.GuildModeration,     // Required for ban/unban events
    GatewayIntentBits.GuildWebhooks,       // Required for webhook events
    GatewayIntentBits.GuildInvites,        // Required for invite tracking
    GatewayIntentBits.GuildEmojisAndStickers, // Required for emoji events
    GatewayIntentBits.GuildMessageReactions, // Required for reaction roles
    GatewayIntentBits.DirectMessages       // Required to receive owner DMs
  ],
  partials: [
    Partials.User,
    Partials.GuildMember,
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

global.client = client; // Make client globally accessible

// Initialize Shoukaku (Lavalink wrapper)
import { Shoukaku, Connectors } from 'shoukaku';
const Nodes = [
  {
    name: 'Athena AWS Premium',
    url: '54.91.178.110:2333',
    auth: 'Prince12',
    secure: false
  }
];
const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes);
shoukaku.on('ready', (name) => {
  console.log(`✅ Lavalink node "${name}" is ready!`);
});

shoukaku.on('error', (name, error) => {
  console.error(`❌ Lavalink node "${name}" error:`, error);
});

shoukaku.on('close', (name, code, reason) => {
  console.log(`🔌 Lavalink node "${name}" closed (${code}): ${reason}`);
});

shoukaku.on('debug', (name, info) => {
  console.log(`[${name}] ${info}`);
});
global.client.shoukaku = shoukaku;

process.on('unhandledRejection', (error) => {
  console.error(chalk.red.bold('Unhandled Promise Rejection:'), error);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red.bold('Uncaught Exception:'), error);
});

// Import event handlers manually for clean compile and zero runtime FS errors
import { connectToHomeVc } from './src/utils/voice.js';
import readyEvent from './src/events/ready.js';
import interactionCreateEvent from './src/events/interactionCreate.js';
import messageCreateEvent from './src/events/messageCreate.js';
import guildMemberAddEvent from './src/events/guildMemberAdd.js';
import channelDeleteEvent from './src/events/channelDelete.js';
import roleDeleteEvent from './src/events/roleDelete.js';
import guildMemberBanAddEvent from './src/events/guildMemberBanAdd.js';
import guildMemberRemoveEvent from './src/events/guildMemberRemove.js';
import channelCreateEvent from './src/events/channelCreate.js';
import roleCreateEvent from './src/events/roleCreate.js';
import guildUpdateEvent from './src/events/guildUpdate.js';
import guildMemberUpdateEvent from './src/events/guildMemberUpdate.js';
import voiceStateUpdateEvent from './src/events/voiceStateUpdate.js';
import roleUpdateEvent from './src/events/roleUpdate.js';
import guildBanRemoveEvent from './src/events/guildBanRemove.js';
import webhookUpdateEvent from './src/events/webhookUpdate.js';
import emojiCreateEvent from './src/events/emojiCreate.js';
import emojiDeleteEvent from './src/events/emojiDelete.js';
import inviteCreateEvent from './src/events/inviteCreate.js';
import inviteDeleteEvent from './src/events/inviteDelete.js';
import messageDeleteEvent from './src/events/messageDelete.js';
import messageReactionAddEvent from './src/events/messageReactionAdd.js';
import messageReactionRemoveEvent from './src/events/messageReactionRemove.js';
import guildCreateEvent from './src/events/guildCreate.js';
import guildAuditLogEntryCreateEvent from './src/events/guildAuditLogEntryCreate.js';
import { scheduleAutoUnquarantine } from './src/commands/security.js';
import db from './src/database.js';

const events = [
  readyEvent,
  interactionCreateEvent,
  messageCreateEvent,
  guildMemberAddEvent,
  channelDeleteEvent,
  roleDeleteEvent,
  guildMemberBanAddEvent,
  guildMemberRemoveEvent,
  channelCreateEvent,
  roleCreateEvent,
  guildUpdateEvent,
  guildMemberUpdateEvent,
  voiceStateUpdateEvent,
  roleUpdateEvent,
  guildBanRemoveEvent,
  webhookUpdateEvent,
  emojiCreateEvent,
  emojiDeleteEvent,
  inviteCreateEvent,
  inviteDeleteEvent,
  messageReactionAddEvent,
  messageReactionRemoveEvent,
  messageDeleteEvent,
  guildCreateEvent,
  guildAuditLogEntryCreateEvent
];

// Register Events
console.log(chalk.gray('🔄 Loading event handlers...'));
events.forEach(event => {
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(chalk.gray(`   ├─ Bound event: `) + chalk.cyan.bold(event.name));
});

// Global Exception Containment (Avoids random crashes during network drops)
process.on('unhandledRejection', error => {
  console.error(chalk.red.bold('\n🔥 Unhandled Promise Rejection:'), error);
});

process.on('uncaughtException', error => {
  console.error(chalk.red.bold('\n🔥 Uncaught Exception Critical:'), error);
});

// Optional lightweight web server for hosting health checks (e.g., Railway)
const PORT = process.env.PORT || null;
if (PORT) {
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('🛡️ Athena Prime Bot is actively online and running!');
    res.end();
  }).listen(PORT, () => {
    console.log(chalk.green(`🌐 Health Check Server: Listening on port ${PORT}`));
  });
}

// Authenticate with Discord APIs
console.log(chalk.yellow('\n⏳ Connecting to Discord Gateway...'));
client.login(token).catch(err => {
  console.error(chalk.red.bold('\n❌ Connection Failed: Invalid token or network blockage!'));
  console.error(err);
  process.exit(1);
});

// Restore auto-unquarantine timers after bot is ready
client.once('ready', async () => {
  const all = db.getAllQuarantinedUsers();
  let restored = 0;
  for (const record of all) {
    if (!record.expiresAt) continue; // permanent quarantine, skip
    const remaining = record.expiresAt - Date.now();
    if (remaining <= 0) {
      // Already expired while bot was offline — unquarantine now
      try {
        const guild = client.guilds.cache.get(record.guildId);
        if (guild) {
          const member = await guild.members.fetch(record.userId).catch(() => null);
          if (member) {
            const { executeUnquarantine } = await import('./src/commands/security.js');
            await executeUnquarantine(guild, member, guild.members.me);
          } else {
            db.removeQuarantine(record.guildId, record.userId);
          }
        }
      } catch { /* ignore */ }
    } else {
      scheduleAutoUnquarantine(client, record.guildId, record.userId, remaining);
      restored++;
    }
  }
  if (restored > 0) {
    console.log(chalk.cyan(`⏰ Restored ${restored} auto-unquarantine timer(s) from database.`));
  }
});

// Graceful Shutdown to ensure DB flushes
function handleShutdown(signal) {
  console.log(chalk.yellow(`\n[System] Received ${signal}, initiating graceful shutdown...`));
  import('./src/database.js').then(({ default: db }) => {
    // Force immediate save if pending
    if (db.needsSave || db.saveTimeout) {
      console.log(chalk.yellow('[System] Flushing database to disk...'));
      clearTimeout(db.saveTimeout);
      db.saveTimeout = null;
      try {
        const fs = require('fs');
        const path = require('path');
        const data = JSON.stringify(db.cache, null, 2);
        fs.writeFileSync(path.resolve('data', 'db.json'), data, 'utf8');
        console.log(chalk.green('[System] Database saved successfully.'));
      } catch (e) {
        console.error('[System] Failed to save database during shutdown:', e);
      }
    }
    process.exit(0);
  }).catch(err => {
    console.error('Error loading db during shutdown:', err);
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
