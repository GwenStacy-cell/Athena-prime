import dotenv from 'dotenv';
dotenv.config();
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get('1400471141054808154');
  if (!guild) return process.exit(1);

  const channel = guild.channels.cache.find(c => c.isTextBased());
  if (channel) {
    let responseText = 'https://images-ext-1.discordapp.net/external/a4kDIA61NIr-ngGrGABcVwKBT0Iho69fKiboblwqHxo/https/media.tenor.com/Poquy6yMgMEAAAPo/bmw-german-car.mp4';
    
    // Extract original URL from Discord proxy link if needed
    const proxyMatch = responseText.match(/https\/([^\s]+)/i);
    if (responseText.includes('discordapp.net/external') && proxyMatch) {
      responseText = 'https://' + proxyMatch[1];
    }

    // Convert Tenor/Imgur/Giphy .mp4 to .gif so Discord can embed it and auto-play
    if (/\.mp4(\?.*)?$/i.test(responseText) && /tenor\.com|giphy\.com|imgur\.com/i.test(responseText)) {
      responseText = responseText.replace(/\.mp4(\?.*)?$/i, '.gif$1');
    }

    const e = new EmbedBuilder().setImage(responseText).setColor(0x2b2d31);
    await channel.send({ embeds: [e] });
    console.log('Sent Proxy Extracted GIF');
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
