import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import chalk from 'chalk';
import http from 'http';

// Load Environment Variables
dotenv.config();

// Print boot header
console.log(chalk.blue.bold('\n============================================='));
console.log(chalk.blue.bold('🛡️   Medusa Prime - Initializing...   🛡️'));
console.log(chalk.blue.bold('=============================================\n'));

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
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [
    Partials.User,
    Partials.GuildMember,
    Partials.Message,
    Partials.Channel
  ]
});

// Import event handlers manually for clean compile and zero runtime FS errors
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
  guildMemberUpdateEvent
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
    res.write('🛡️ Medusa Prime Bot is actively online and running!');
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
