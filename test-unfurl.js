import dotenv from 'dotenv';
dotenv.config();
import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get('1400471141054808154');
  if (!guild) return process.exit(1);

  // find any text channel
  const channel = guild.channels.cache.find(c => c.isTextBased());
  if (channel) {
    const url = 'https://media.tenor.com/Poquy6yMgMEAAAPo/bmw-german-car.mp4';
    await channel.send(`[\u200B](${url})`);
    console.log('Sent masked link');
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
