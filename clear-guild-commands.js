import dotenv from 'dotenv';
dotenv.config();

import { REST, Routes, Client, GatewayIntentBits } from 'discord.js';

const clientId = process.env.CLIENT_ID;
const token = process.env.DISCORD_TOKEN;

if (!token || !clientId) {
  console.error('Missing token or clientId');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(token);
  
  const guilds = client.guilds.cache.map(g => g.id);
  console.log(`Found ${guilds.length} guilds. Deleting guild-specific commands...`);
  
  for (const guildId of guilds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: [] },
      );
      console.log(`✅ Cleared guild commands for ${guildId}`);
    } catch (err) {
      console.error(`❌ Failed to clear guild commands for ${guildId}:`, err.message);
    }
  }
  
  console.log('Done!');
  process.exit(0);
});

client.login(token);
