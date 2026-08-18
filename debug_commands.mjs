import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { config } from 'dotenv';
import { allCommands } from './src/commands/loader.js';

config();

async function run() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
  const slashData = allCommands
    .filter(cmd => !cmd.hidden && !cmd.slashHidden && typeof cmd.executeSlash === 'function')
    .map(cmd => {
      return {
        name: cmd.name,
        description: cmd.description,
        options: cmd.options || [],
        default_member_permissions: cmd.permissions ? cmd.permissions.reduce((a, b) => BigInt(a) | BigInt(b), 0n).toString() : null
      };
    });

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
      const errors = error.rawError.errors;
      for (const [index, err] of Object.entries(errors)) {
        console.log(`Index ${index} failed:`, slashData[index].name);
        console.log(JSON.stringify(err, null, 2));
      }
    } else {
      console.error(error);
    }
  }
}

run();
