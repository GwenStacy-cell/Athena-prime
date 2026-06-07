import dotenv from 'dotenv';
dotenv.config();
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get('1400471141054808154');
  if (!guild) return process.exit(1);

  const channel = guild.channels.cache.find(c => c.isTextBased());
  if (channel) {
    const rawUrl = 'https://media.tenor.com/Poquy6yMgMEAAAPo/bmw-german-car.mp4';
    const gifUrl = rawUrl.replace(/\.mp4$/i, '.gif');
    
    const e = new EmbedBuilder().setImage(gifUrl);
    
    await channel.send({ embeds: [e] });
    console.log('Sent Embed GIF');
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
