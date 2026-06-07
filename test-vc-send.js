import dotenv from 'dotenv';
dotenv.config();
import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get('1400471141054808154');
  if (!guild) {
    console.error('Guild not found');
    process.exit(1);
  }

  try {
    const tempChannel = await guild.channels.create({
      name: `Test-Room`,
      type: ChannelType.GuildVoice,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.Connect, 
            PermissionFlagsBits.ManageChannels, 
            PermissionFlagsBits.MoveMembers, 
            PermissionFlagsBits.ViewChannel, 
            PermissionFlagsBits.SendMessages
          ]
        }
      ]
    });

    console.log(`Created channel ${tempChannel.name} (${tempChannel.id})`);

    setTimeout(async () => {
      try {
        const freshChannel = await guild.channels.fetch(tempChannel.id);
        const embed = new EmbedBuilder().setTitle('Test').setDescription('test');
        await freshChannel.send({ embeds: [embed] });
        console.log('✅ Sent panel to VC text successfully');
      } catch (e) {
        console.error(`❌ VC text send failed:`, e);
      }
      
      await tempChannel.delete().catch(()=>null);
      process.exit(0);
    }, 2000);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
