import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { config } from 'dotenv';
import { allCommands } from './src/commands/loader.js';

config();

async function run() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
  const slashData = allCommands.map(cmd => ({
    name: cmd.name,
    description: cmd.description,
    options: cmd.options || [],
    default_member_permissions: cmd.permissions ? cmd.permissions.reduce((a, b) => BigInt(a) | BigInt(b), 0n).toString() : null
  }));

  try {
    console.log('Sending', slashData.length, 'commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: slashData }
    );
    console.log('Successfully registered all commands');
  } catch (error) {
    if (error.rawError && error.rawError.errors) {
      console.log("Validation Error:");
      console.log(JSON.stringify(error.rawError.errors, null, 2));
    } else {
      console.error(error);
    }
  }
}

run();
