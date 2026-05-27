import dotenv from 'dotenv';
dotenv.config();

import { REST, Routes } from 'discord.js';
import { allCommands } from './src/commands/loader.js';

const clientId = process.env.CLIENT_ID;
const token = process.env.DISCORD_TOKEN;

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('❌ ERROR: Discord token (DISCORD_TOKEN) is missing in .env!');
  process.exit(1);
}

if (!clientId || clientId === 'your_bot_client_id') {
  console.error('❌ ERROR: Client ID (CLIENT_ID) is missing in .env!');
  console.error('Please configure your Client ID inside your .env file before running this deploy script.');
  process.exit(1);
}

// Map the commands to the JSON structure required by Discord APIs
const slashData = allCommands.map(cmd => {
  return {
    name: cmd.name,
    description: cmd.description,
    options: cmd.options || [],
    // Convert permissions to string format for Discord gateway payload
    default_member_permissions: cmd.permissions && cmd.permissions.length > 0 
      ? cmd.permissions.reduce((acc, perm) => acc | perm, 0n).toString() 
      : null
  };
});

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('⏳ Deploying slash commands globally...');

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: slashData },
    );

    console.log(`✅ Successfully deployed all ${slashData.length} slash commands.`);
  } catch (error) {
    console.error('❌ Error deploying slash commands:', error);
  }
})();
