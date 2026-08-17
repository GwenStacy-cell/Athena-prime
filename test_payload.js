import { config } from 'dotenv';
config();
import { Client, IntentsBitField, MessageFlags } from 'discord.js';

const client = new Client({ intents: [IntentsBitField.Flags.Guilds] });

client.once('ready', async () => {
  try {
    const guild = client.guilds.cache.first();
    const channel = guild.channels.cache.filter(c => c.isTextBased()).first();

    const container = {
      type: 17,
      components: [
        {
          type: 9,
          components: [{ type: 10, content: '# Test title\n-# Test description' }],
          accessory: { type: 11, media: { url: 'https://cdn.discordapp.com/embed/avatars/0.png' } }
        },
        { type: 14, divider: true },
        { type: 10, content: '-# **Athena Bulletproof Security !!!**' }
      ]
    };

    await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    console.log('Success!');
  } catch (err) {
    console.error(err.rawError || err.message);
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);