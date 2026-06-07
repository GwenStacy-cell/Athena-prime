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

// Commands that should be available in DMs via User App install
const USER_APP_COMMANDS = ['spam', 'spampermit', 'spamrevoke', 'spamlist'];

// Map the commands to the JSON structure required by Discord APIs
const slashData = allCommands
  .filter(cmd => !cmd.slashHidden)   // exclude prefix-only commands like enuke
  .map(cmd => {
  const isUserApp = USER_APP_COMMANDS.includes(cmd.name);

  return {
    name: cmd.name,
    description: cmd.description,
    options: cmd.options || [],
    // Do NOT set default_member_permissions — setting it causes Discord to hide
    // the command client-side from users who lack it, breaking bot owner bypass.
    // All permission enforcement is handled inside the bot's own code.
    default_member_permissions: null,
    // integration_types: 0 = Guild Install, 1 = User Install
    integration_types: isUserApp ? [0, 1] : [0],
    // contexts: 0 = Guild, 1 = Bot DM, 2 = Private Channel (group DM)
    contexts: isUserApp ? [0, 1, 2] : [0]
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
