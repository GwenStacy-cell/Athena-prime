import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } from '@discordjs/voice';
import fs from 'fs';
import play from 'play-dl';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { connectToHomeVc } from './voice.js';

play.getFreeClientID().then((clientID) => {
  play.setToken({
    soundcloud: { client_id: clientID }
  });
}).catch(err => console.error('Failed to get SC client ID:', err));

const queues = new Map(); 
const leaveTimeouts = new Map();

export function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      player: createAudioPlayer(),
      connection: null,
      songs: [],
      current: null,
      textChannelId: null,
      messageId: null,
      textChannel: null,
      isPlaying: false,
      loop: false,
      volume: 100
    });
    
    const queue = queues.get(guildId);
    
    queue.player.on(AudioPlayerStatus.Idle, () => {
      if (queue.songs.length > 0) {
        queue.current = queue.songs.shift();
        playResource(guildId, queue.current);
      } else {
        queue.current = null;
        queue.isPlaying = false;
        updatePlayerUI(guildId);
        startLeaveTimeout(guildId);
      }
    });

    queue.player.on('error', error => {
      console.error(`Error playing audio in guild ${guildId}:`, error);
      fs.writeFileSync('music_error_log.txt', String(error?.stack || error));
      queue.player.stop();
    });

    queue.player.on('stateChange', (oldState, newState) => {
      fs.appendFileSync('music_state_log.txt', `State changed: ${oldState.status} -> ${newState.status}\n`);
    });
  }
  return queues.get(guildId);
}

function startLeaveTimeout(guildId) {
  if (leaveTimeouts.has(guildId)) clearTimeout(leaveTimeouts.get(guildId));
  const timeout = setTimeout(() => {
    const queue = queues.get(guildId);
    if (!queue || queue.isPlaying) return;
    
    const cfg = db.getGuildConfig(guildId);
    const homeVcId = cfg.homeVcId;
    
    if (homeVcId) {
      const client = global.client;
      if (client) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) connectToHomeVc(guild, homeVcId);
      }
    } else if (queue.connection) {
      queue.connection.destroy();
      queue.connection = null;
    }
    
  }, 3000);
  leaveTimeouts.set(guildId, timeout);
}

function stopLeaveTimeout(guildId) {
  if (leaveTimeouts.has(guildId)) {
    clearTimeout(leaveTimeouts.get(guildId));
    leaveTimeouts.delete(guildId);
  }
}

export async function enqueue(guild, member, query) {
  const queue = getQueue(guild.id);
  
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) return { success: false, message: 'You need to be in a voice channel to play music!' };
  
  const connection = getVoiceConnection(guild.id);
  if (!connection || connection.joinConfig.channelId !== voiceChannel.id) {
    queue.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false
    });
    queue.connection.subscribe(queue.player);
  } else if (!queue.connection) {
    queue.connection = connection;
    queue.connection.subscribe(queue.player);
  }

  stopLeaveTimeout(guild.id);
  
  try {
    let results;
    if (query.startsWith('http')) {
      const type = await play.validate(query);
      if (type === 'yt_playlist') {
        const playlist = await play.playlist_info(query, { incomplete: true });
        const videos = await playlist.all_videos();
        const songs = videos.map(v => ({
          title: v.title,
          url: v.url,
          duration: v.durationRaw,
          thumbnail: v.thumbnails?.[0]?.url,
          requester: member.user
        }));
        queue.songs.push(...songs);
        
        if (!queue.isPlaying && !queue.current) {
          queue.current = queue.songs.shift();
          playResource(guild.id, queue.current);
        } else {
          updatePlayerUI(guild.id);
        }
        return { success: true, message: `Added playlist **${playlist.title}** (${songs.length} songs) to queue.` };
      } else if (type === 'sp_track' || type === 'sp_playlist' || type === 'sp_album') {
         if (play.is_expired()) await play.refreshToken();
         const sp_data = await play.spotify(query);
         
         if (type === 'sp_track') {
           const searched = await play.search(`${sp_data.name} ${sp_data.artists[0].name}`, { limit: 1 });
           if (!searched.length) return { success: false, message: 'Could not find that Spotify track on YouTube.' };
           results = searched;
         } else {
           const tracks = await sp_data.all_tracks();
           const songs = [];
           for (const track of tracks) {
              songs.push({
                title: `${track.name} - ${track.artists[0].name}`,
                url: null,
                isSpotify: true,
                duration: 'Unknown',
                requester: member.user
              });
           }
           queue.songs.push(...songs);
           if (!queue.isPlaying && !queue.current) {
             queue.current = queue.songs.shift();
             playResource(guild.id, queue.current);
           } else {
             updatePlayerUI(guild.id);
           }
           return { success: true, message: `Added Spotify playlist **${sp_data.name}** (${songs.length} songs) to queue.` };
         }
      } else {
        const info = await play.video_info(query);
        results = [info.video_details];
      }
    } else {
      results = await play.search(query, { limit: 1 });
    }
    
    if (!results || !results.length) return { success: false, message: 'No results found for that query.' };
    
    const song = {
      title: results[0].title,
      url: results[0].url,
      duration: results[0].durationRaw,
      thumbnail: results[0].thumbnails?.[0]?.url,
      requester: member.user
    };
    
    queue.songs.push(song);
    
    if (!queue.isPlaying && !queue.current) {
      queue.current = queue.songs.shift();
      playResource(guild.id, queue.current);
    } else {
      updatePlayerUI(guild.id);
    }
    
    return { success: true, message: `Added **${song.title}** to queue.` };
  } catch (error) {
    console.error(`Music enqueue error:`, error);
    return { success: false, message: `An error occurred: ${error.message}` };
  }
}

async function playResource(guildId, song) {
  const queue = getQueue(guildId);
  try {
    let playUrl = song.url;
    
    // If it's a Spotify track or YouTube track, we bypass YouTube stream restrictions
    // by streaming the equivalent track from SoundCloud.
    if (!playUrl || !playUrl.includes('soundcloud.com')) {
      const searched = await play.search(song.title, { limit: 1, source: { soundcloud: 'tracks' } });
      if (searched.length > 0) {
        playUrl = searched[0].url;
        song.thumbnail = song.thumbnail || searched[0].thumbnails?.[0]?.url;
      } else {
        queue.player.stop();
        return;
      }
    }
    
    const stream = await play.stream(playUrl);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    
    resource.playStream.on('error', err => {
       console.error('Resource stream error:', err);
       fs.writeFileSync('music_resource_error.txt', String(err?.stack || err));
    });
    
    queue.player.play(resource);
    queue.isPlaying = true;
    updatePlayerUI(guildId);
  } catch (error) {
    console.error(`Error streaming song:`, error);
    fs.writeFileSync('music_error_log.txt', String(error?.stack || error));
    queue.player.stop();
  }
}

export async function updatePlayerUI(guildId) {
  const queue = getQueue(guildId);
  const cfg = db.getGuildConfig(guildId);
  if (!cfg.musicChannelId || !cfg.musicMessageId) return;
  
  if (!queue.textChannel) {
    const client = global.client;
    if (!client) return;
    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
      queue.textChannel = guild.channels.cache.get(cfg.musicChannelId) || await guild.channels.fetch(cfg.musicChannelId);
    } catch { return; }
  }
  
  if (!queue.textChannel) return;
  
  try {
    const message = await queue.textChannel.messages.fetch(cfg.musicMessageId);
    if (!message) return;
    
    const embed = new EmbedBuilder()
      .setColor(cfg.accentColor || '#ff0000')
      .setAuthor({ name: 'Compact Music Player', iconURL: global.client?.user?.displayAvatarURL() });

    if (cfg.musicCoverImage) {
      embed.setImage(cfg.musicCoverImage);
    }
    
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

    if (queue.current) {
      desc += `**⸻ NOW PLAYING**\n[${queue.current.title}](${queue.current.url}) [${queue.current.duration}]\nRequested by: ${queue.current.requester}\n\n`;
      if (queue.songs.length > 0) {
        desc += `**⸻ NEXT UP**\n[${queue.songs[0].title}](${queue.songs[0].url}) [${queue.songs[0].duration}]\n`;
        if (queue.songs.length > 1) {
          desc += `...and ${queue.songs.length - 1} more in queue.\n`;
        }
      }
    } else {
      desc += '**Status:** ⸻ Ready to play';
    }
    
    embed.setDescription(desc);
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_play').setLabel('Play').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('music_pause').setLabel('Pause').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_queue').setLabel('Queue').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setStyle(ButtonStyle.Danger)
    );
    
    await message.edit({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error(`Failed to update music UI for guild ${guildId}:`, error);
    fs.writeFileSync('music_ui_error.txt', String(error?.stack || error));
  }
}

export async function handleInteraction(interaction) {
  const queue = getQueue(interaction.guildId);
  const action = interaction.customId.replace('music_', '');
  
  if (action === 'play') {
    if (!queue.current) {
      return interaction.reply({ content: `There is no music playing.`, ephemeral: true });
    }
    if (queue.player.state.status === AudioPlayerStatus.Paused) {
      queue.player.unpause();
      await interaction.reply({ content: `${interaction.user} resumed the playback.`, ephemeral: false });
    } else {
      await interaction.reply({ content: `The music is already playing.`, ephemeral: true });
    }
    updatePlayerUI(interaction.guildId);
    
  } else if (action === 'pause') {
    if (!queue.current) {
      return interaction.reply({ content: `There is no music playing.`, ephemeral: true });
    }
    if (queue.player.state.status !== AudioPlayerStatus.Paused) {
      queue.player.pause();
      await interaction.reply({ content: `${interaction.user} paused the playback.`, ephemeral: false });
    } else {
      await interaction.reply({ content: `The music is already paused.`, ephemeral: true });
    }
    updatePlayerUI(interaction.guildId);
    
  } else if (action === 'skip') {
    if (!queue.current) {
      return interaction.reply({ content: `There is nothing to skip.`, ephemeral: true });
    }
    queue.player.stop();
    await interaction.reply({ content: `${interaction.user} skipped **${queue.current.title}**.`, ephemeral: false });
    
  } else if (action === 'stop') {
    queue.songs = [];
    queue.current = null;
    queue.player.stop();
    await interaction.reply({ content: `${interaction.user} stopped the music and cleared the queue.`, ephemeral: false });
    startLeaveTimeout(interaction.guildId);
    
  } else if (action === 'queue') {
    if (queue.songs.length === 0) {
      return interaction.reply({ content: `The queue is currently empty.`, ephemeral: true });
    }
    const qList = queue.songs.slice(0, 10).map((s, i) => `${i + 1}. **${s.title}** [${s.duration}]`).join('\n');
    let msg = `**Current Queue:**\n${qList}`;
    if (queue.songs.length > 10) msg += `\n*...and ${queue.songs.length - 10} more*`;
    return interaction.reply({ content: msg, ephemeral: true });
  }
}
