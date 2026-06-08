import dotenv from 'dotenv';
dotenv.config();
import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get('1400471141054808154');
  if (!guild) return process.exit(1);

  const vc = guild.channels.cache.find(c => c.isVoiceBased());
  if (vc) {
    console.log(typeof vc.setStatus, typeof vc.setVoiceStatus);
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
