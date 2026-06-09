import dotenv from 'dotenv';
dotenv.config();
import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import fs from 'fs';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get('1400471141054808154');
  if (!guild) return process.exit(1);

  console.log("Found guild", guild.name);
  
  // Serialize
  const channelTypes = [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum
  ];

  const channels = guild.channels.cache
    .filter(c => channelTypes.includes(c.type))
    .map(c => ({
      name:       c.name,
      type:       c.type,
      position:   c.position,
      topic:      c.topic || null,
      nsfw:       c.nsfw || false,
      bitrate:    c.bitrate || null,
      userLimit:  c.userLimit || null,
      slowmode:   c.rateLimitPerUser || 0,
      parentName: c.parent?.name || null,
    }));

  const backupData = { channels };
  
  // Just try to recreate ONE channel using the exact payload ezal uses
  for (const chData of backupData.channels) {
    if (chData.type === ChannelType.GuildText) {
      console.log("Attempting to create", chData.name);
      try {
        await guild.channels.create({
          name:             chData.name,
          type:             chData.type,
          topic:            chData.topic || undefined,
          nsfw:             chData.nsfw,
          bitrate:          chData.bitrate || undefined,
          userLimit:        chData.userLimit || undefined,
          rateLimitPerUser: chData.slowmode || undefined,
          parent:           undefined,
          reason:           'Athena Prime — Backup Restore'
        });
        console.log("Success creating", chData.name);
      } catch (err) {
        console.error("Failed to create", chData.name, err);
      }
      break;
    }
  }

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
