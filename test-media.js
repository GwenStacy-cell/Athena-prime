import dotenv from 'dotenv';
dotenv.config();
import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get('1400471141054808154');
  if (!guild) return process.exit(1);

  const channel = guild.channels.cache.find(c => c.isTextBased());
  if (channel) {
    const rawUrl = 'https://media.tenor.com/Poquy6yMgMEAAAPo/bmw-german-car.mp4';
    
    await channel.send(`Test 1 (Raw Text): ${rawUrl}`);
    
    await channel.send(`Test 2 (Markdown space): [ ](${rawUrl})`);
    
    await channel.send(`Test 3 (Markdown char): [\u200D](${rawUrl})`);

    // Extract Tenor ID and try Tenor Page URL
    await channel.send(`Test 4 (Tenor Page?): https://tenor.com/view/bmw-german-car-Poquy6yMgMEAAAPo`);
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
