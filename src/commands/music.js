import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { enqueue } from '../utils/musicManager.js';
import play from 'play-dl';
import yt from 'youtube-ext';

export const commands = [
  {
    name: 'setupmusic',
    description: 'Set up the Compact Music Player channel',
    category: 'music',
    permissions: [PermissionFlagsBits.ManageGuild],
    
    slashDef: new SlashCommandBuilder()
      .setName('setupmusic')
      .setDescription('Create the Compact Music Player channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption(opt => opt
        .setName('image_url')
        .setDescription('Custom cover image or GIF URL for the music player embed')
        .setRequired(false)
      ),
      
    async executePrefix(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply({ embeds: [embed.danger('Permission Denied', 'You need `ManageGuild` permissions to setup the music player.')] });
      }
      await setupMusicChannel(message.guild, message.channel, args[0]);
    },
    
    async executeSlash(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const imageUrl = interaction.options.getString('image_url');
      await setupMusicChannel(interaction.guild, interaction.channel, imageUrl, interaction);
    }
  },
  
  {
    name: 'play',
    description: 'Play a song in your voice channel',
    category: 'music',
    permissions: [],
    
    slashDef: new SlashCommandBuilder()
      .setName('play')
      .setDescription('Search for a song or play a URL')
      .addStringOption(opt => opt
        .setName('query')
        .setDescription('Song name, YouTube URL, or Spotify URL')
        .setRequired(true)
        .setAutocomplete(true)
      ),
      
    async autocomplete(interaction) {
      const focusedValue = interaction.options.getFocused();
      if (!focusedValue || focusedValue.length < 3) return interaction.respond([]);
      
      try {
        if (!focusedValue.startsWith('http')) {
          const results = await yt.search(focusedValue);
          const choices = (results.videos || []).slice(0, 5).map(r => {
            return {
              name: `${r.title} [${r.duration?.text || '?'}]`.substring(0, 100),
              value: r.url
            };
          });
          await interaction.respond(choices);
        } else {
          await interaction.respond([]);
        }
      } catch (error) {
        await interaction.respond([]);
      }
    },
      
    async executePrefix(message, args) {
      if (!args.length) return message.reply({ embeds: [embed.warn('Invalid Usage', 'Please provide a song name or URL.')] });
      const query = args.join(' ');
      const res = await enqueue(message.guild, message.member, query);
      
      if (res.success) {
        message.reply({ embeds: [embed.success('Queued', res.message)] });
      } else {
        message.reply({ embeds: [embed.danger('Error', res.message)] });
      }
    },
    
    async executeSlash(interaction) {
      await interaction.deferReply({ ephemeral: false });
      const query = interaction.options.getString('query');
      
      const res = await enqueue(interaction.guild, interaction.member, query);
      
      if (res.success) {
        interaction.editReply({ embeds: [embed.success('Queued', res.message)] });
      } else {
        interaction.editReply({ embeds: [embed.danger('Error', res.message)] });
      }
    }
  }
];

async function setupMusicChannel(guild, commandChannel, imageUrl, interaction = null) {
  try {
    const channel = await guild.channels.create({
      name: 'music-requests',
      type: ChannelType.GuildText,
      topic: 'Type a song name or URL to play music. Do not chat here.'
    });
    
    const cfg = db.getGuildConfig(guild.id);
    const coverImage = imageUrl || 'https://i.imgur.com/8Qj85vP.gif'; // Default aesthetic GIF
    
    const playerEmbed = new EmbedBuilder()
      .setColor(cfg.accentColor || '#ff0000')
      .setAuthor({ name: 'Compact Music Player', iconURL: global.client?.user?.displayAvatarURL() })
      .setImage(coverImage);
      
    let desc = '⸻ Welcome to the Athena Prime Music Console, your dedicated gateway to a seamless, premium, and uninterrupted high-fidelity audio experience. ⸻\n\n';
    desc += '**⸻ CORE CAPABILITIES**\n\n';
    desc += '• **Instant Playback:** Lightning-fast audio streaming initialization.\n';
    desc += '• **Unrestricted Access:** Unlimited song requests and playlist support.\n';
    desc += '• **High-Fidelity Audio:** Crystal-clear streaming resolution.\n';
    desc += '• **Advanced Queue Management:** Organize, skip, and manage your tracks.\n';
    desc += '• **Interactive Interface:** Complete control via tactile dashboard buttons.\n';
    desc += '• **Seamless Integration:** Automatic synchronization with your Voice Channels.\n\n';
    desc += '**⸻ INSTRUCTIONS**\n\n';
    desc += '» **Join** any active voice channel.\n';
    desc += '» **Search** by typing a song name or pasting a URL directly in this channel.\n';
    desc += '» **Control** your playback using the module below.\n\n';
    desc += '**Status:** ⸻ Ready to play';
    
    playerEmbed.setDescription(desc);
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_play').setLabel('Play').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('music_pause').setLabel('Pause').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_queue').setLabel('Queue').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setStyle(ButtonStyle.Danger)
    );
    
    const message = await channel.send({ embeds: [playerEmbed], components: [row] });
    
    db.updateGuildConfig(guild.id, {
      musicChannelId: channel.id,
      musicMessageId: message.id,
      musicCoverImage: coverImage
    });
    
    const successEmbed = embed.success('Music Setup Complete', `Created ${channel} and posted the Compact Music Player interface.`);
    if (interaction) {
      await interaction.editReply({ embeds: [successEmbed] });
    } else {
      await commandChannel.send({ embeds: [successEmbed] });
    }
    
  } catch (err) {
    console.error('Setup music error:', err);
    const failEmbed = embed.danger('Setup Failed', 'Could not create the channel. Please check my permissions.');
    if (interaction) {
      await interaction.editReply({ embeds: [failEmbed] });
    } else {
      await commandChannel.send({ embeds: [failEmbed] });
    }
  }
}
