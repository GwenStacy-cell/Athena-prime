import dotenv from 'dotenv';
dotenv.config();
import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get('1400471141054808154');
  if (!guild) return process.exit(1);

  try {
    await guild.channels.create({
      name:             'test-restore',
      type:             ChannelType.GuildText,
      topic:            undefined,
      nsfw:             false,
      bitrate:          undefined,
      userLimit:        undefined,
      rateLimitPerUser: undefined,
      parent:           undefined,
      reason:           'Athena Prime — Backup Restore'
    });
    console.log("Success");
  } catch (err) {
    console.error("Error creating channel:", err);
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
