import dotenv from 'dotenv';
dotenv.config();

import { REST, Routes, Client, GatewayIntentBits } from 'discord.js';
import { allCommands } from './src/commands/loader.js';

const clientId = process.env.CLIENT_ID;
const token = process.env.DISCORD_TOKEN;

if (!token || !clientId) {
  console.error('Missing token or clientId');
  process.exit(1);
}

const slashData = allCommands
  .filter(cmd => !cmd.slashHidden)
  .map(cmd => {
    return {
      name: cmd.name,
      description: cmd.description,
      options: cmd.options || [],
      default_member_permissions: null,
      integration_types: [0],
      contexts: [0]
    };
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(token);
  
  const guilds = client.guilds.cache.map(g => g.id);
  console.log(`Found ${guilds.length} guilds. Deploying to all...`);
  
  for (const guildId of guilds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: slashData },
      );
      console.log(`✅ Deployed to guild ${guildId}`);
    } catch (err) {
      console.error(`❌ Failed to deploy to guild ${guildId}:`, err.message);
    }
  }
  
  console.log('Done!');
  process.exit(0);
});

client.login(token);
