import fs from 'fs';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import db from '../database.js';
import { connectToHomeVc } from './voice.js';

const queues = new Map(); 
const leaveTimeouts = new Map();

export function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      player: null,
      songs: [],
      current: null,
      textChannelId: null,
      messageId: null,
      textChannel: null,
      isPlaying: false,
      loop: false,
      queue: [],
      volume: 100,
      isPreparing: false,
      repeatTrack: false,
      nowPlayingMsgMusicId: null,
      nowPlayingMsgVcId: null
    });
  }
  return queues.get(guildId);
}

function startLeaveTimeout(guildId) {
  if (leaveTimeouts.has(guildId)) clearTimeout(leaveTimeouts.get(guildId));
  const timeout = setTimeout(async () => {
    const queue = queues.get(guildId);
    if (!queue || queue.isPlaying) return;
    
    if (queue.player) {
      const shoukaku = global.client.shoukaku;
      await shoukaku.leaveVoiceChannel(guildId);
      queue.player = null;
    }
    
    const cfg = db.getGuildConfig(guildId);
    if (cfg.homeVcId) {
       const guild = global.client.guilds.cache.get(guildId);
       if (guild) connectToHomeVc(guild, cfg.homeVcId);
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
  
  queue.isPreparing = true;
  stopLeaveTimeout(guild.id);
  
  const shoukaku = global.client.shoukaku;
  if (!shoukaku) {
     queue.isPreparing = false;
     return { success: false, message: 'Lavalink node is not initialized yet.' };
  }
  
  try {
    if (!queue.player) {
      const nativeConn = getVoiceConnection(guild.id);
      if (nativeConn) nativeConn.destroy();
      
      let player = shoukaku.players.get(guild.id);
      if (!player) {
        try {
          player = await shoukaku.joinVoiceChannel({
            guildId: guild.id,
            channelId: voiceChannel.id,
            shardId: guild.shardId
          });
        } catch (err) {
          if (err.message && err.message.includes('existing connection')) {
            await shoukaku.leaveVoiceChannel(guild.id);
            await new Promise(r => setTimeout(r, 500));
            player = await shoukaku.joinVoiceChannel({
              guildId: guild.id,
              channelId: voiceChannel.id,
              shardId: guild.shardId
            });
          } else {
            throw err;
          }
        }
      } else if (guild.members.me.voice.channelId !== voiceChannel.id) {
        await guild.members.me.voice.setChannel(voiceChannel.id).catch(() => null);
      }
      
      queue.player = player;
      
      queue.player.on('end', () => {
        if (queue.repeatTrack && queue.current) {
          queue.songs.unshift(queue.current);
        }
        
        if (queue.songs.length > 0) {
          queue.current = queue.songs.shift();
          playResource(guild.id, queue.current);
        } else {
          queue.current = null;
          queue.isPlaying = false;
          updatePlayerUI(guild.id);
          clearNowPlayingEmbeds(guild.id);
          startLeaveTimeout(guild.id);
        }
      });
      
      queue.player.on('error', (err) => {
        console.error('Lavalink Player Error:', err);
        fs.writeFileSync('music_error_log.txt', String(err));
      });
    }
    
    const node = shoukaku.options.nodeResolver(shoukaku.nodes);
    if (!node) {
      queue.isPreparing = false;
      return { success: false, message: 'No available Lavalink nodes.' };
    }
    
    let searchStr = query;
    if (!query.startsWith('http')) searchStr = `ytsearch:${query}`;
    
    const result = await node.rest.resolve(searchStr);
    
    if (!result || (result.loadType !== 'track' && result.loadType !== 'playlist' && result.loadType !== 'search')) {
       queue.isPreparing = false;
       return { success: false, message: 'No results found for that query.' };
    }
    
    let addedCount = 0;
    let title = '';
    
    if (result.loadType === 'playlist') {
       for (const track of result.data.tracks) {
          queue.songs.push({
            title: track.info.title,
            url: track.info.uri,
            duration: formatDuration(track.info.length),
            encoded: track.encoded,
            requester: member.user
          });
       }
       addedCount = result.data.tracks.length;
       title = result.data.info.name || 'Playlist';
    } else if (result.loadType === 'track') {
       const track = result.data;
       queue.songs.push({
          title: track.info.title,
          url: track.info.uri,
          duration: formatDuration(track.info.length),
          encoded: track.encoded,
          requester: member.user
       });
       addedCount = 1;
       title = track.info.title;
    } else if (result.loadType === 'search') {
       const track = result.data[0];
       queue.songs.push({
          title: track.info.title,
          url: track.info.uri,
          duration: formatDuration(track.info.length),
          encoded: track.encoded,
          requester: member.user
       });
       addedCount = 1;
       title = track.info.title;
    }
    
    if (!queue.isPlaying && !queue.current) {
      queue.current = queue.songs.shift();
      playResource(guild.id, queue.current);
    } else {
      updatePlayerUI(guild.id);
    }
    
    queue.isPreparing = false;
    return { success: true, message: `Added **${title}**${addedCount > 1 ? ` (${addedCount} songs)` : ''} to queue.` };
  } catch (error) {
    console.error(`Music enqueue error:`, error);
    queue.isPreparing = false;
    return { success: false, message: `An error occurred: ${error.message}` };
  }
}

async function playResource(guildId, song) {
  const queue = getQueue(guildId);
  try {
    if (queue.player && song.encoded) {
       queue.player.playTrack({ track: { encoded: song.encoded } }).catch(console.error);
       queue.isPlaying = true;
       updatePlayerUI(guildId);
       updateNowPlayingEmbeds(guildId);
    }
  } catch (error) {
    console.error(`Error streaming song:`, error);
    fs.writeFileSync('music_error_log.txt', String(error?.stack || error));
    
    if (global.client && queue.textChannel) {
      const channel = global.client.channels.cache.get(queue.textChannel);
      if (channel) channel.send(`️ Audio Engine Crash: \`${error.message}\``).catch(()=>{});
    }
    if (queue.player) queue.player.stopTrack();
  }
}

function formatDuration(ms) {
  if (!ms) return 'Unknown';
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function buildNowPlayingEmbed(guildId) {
  const queue = getQueue(guildId);
  const cfg = db.getGuildConfig(guildId);
  if (!queue.current) return null;
  
  const embed = new EmbedBuilder()
    .setColor(cfg.accentColor || '#ff0000')
    .setAuthor({ name: 'Now Playing', iconURL: global.client?.user?.displayAvatarURL() })
    .setTitle(queue.current.title)
    .setURL(queue.current.url)
    .addFields(
      { name: 'Duration', value: queue.current.duration, inline: true },
      { name: 'Requested By', value: `<@${queue.current.requester.id}>`, inline: true },
      { name: 'Songs Left in Queue', value: queue.songs.length.toString(), inline: true }
    );
    
  if (cfg.musicCoverImage) embed.setThumbnail(cfg.musicCoverImage);
  return embed;
}

async function updateNowPlayingEmbeds(guildId) {
  const queue = getQueue(guildId);
  if (!queue.current || !queue.isPlaying) return;
  
  const embed = buildNowPlayingEmbed(guildId);
  if (!embed) return;
  
  if (queue.player) {
     try {
       const guild = global.client.guilds.cache.get(guildId);
       const vcId = guild.members.me.voice?.channelId;
       const vc = guild.channels.cache.get(vcId);
       if (vc && vc.isTextBased()) {
         if (queue.nowPlayingMsgVcId) {
            try {
              const msg = await vc.messages.fetch(queue.nowPlayingMsgVcId);
              if (msg) await msg.edit({ embeds: [embed] });
            } catch (e) {
              const newMsg = await vc.send({ embeds: [embed] }).catch(()=>null);
              if (newMsg) queue.nowPlayingMsgVcId = newMsg.id;
            }
         } else {
            const newMsg = await vc.send({ embeds: [embed] }).catch(()=>null);
            if (newMsg) queue.nowPlayingMsgVcId = newMsg.id;
         }
       }
     } catch (e) { console.error('Failed to update VC embed:', e); }
  }
}

async function clearNowPlayingEmbeds(guildId) {
  const queue = getQueue(guildId);
  
  if (queue.player) {
    try {
       const guild = global.client.guilds.cache.get(guildId);
       const vcId = guild.members.me.voice?.channelId;
       const vc = guild.channels.cache.get(vcId);
       if (vc && queue.nowPlayingMsgVcId) {
          const msg = await vc.messages.fetch(queue.nowPlayingMsgVcId);
          if (msg) await msg.delete().catch(()=>null);
       }
    } catch(e) {}
    queue.nowPlayingMsgVcId = null;
  }
}

async function broadcastAction(guildId, user, actionText) {
  const queue = getQueue(guildId);
  if (!queue.player) return;
  const cfg = db.getGuildConfig(guildId);
  const embed = new EmbedBuilder()
    .setColor(cfg.accentColor || '#ff0000')
    .setDescription(`**${user}** ${actionText}.`);
  try {
     const guild = global.client.guilds.cache.get(guildId);
     const vcId = guild.members.me.voice?.channelId;
     const vc = guild.channels.cache.get(vcId);
     if (vc && vc.isTextBased()) {
        await vc.send({ embeds: [embed] }).catch(()=>null);
     }
  } catch(e) {}
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

    if (cfg.musicCoverImage) embed.setImage(cfg.musicCoverImage);
    
    let desc = '⸻ Welcome to the Athena Prime Music Console, your dedicated gateway to a seamless, premium, and uninterrupted high-fidelity audio experience. ⸻\n\n';
    desc += '**⸻ INSTRUCTIONS**\n\n';
    desc += '» **Join** any active voice channel.\n';
    desc += '» **Search** by typing a song name or pasting a URL directly in this channel.\n';
    desc += '» **Control** your playback using the module below.\n\n';

    if (queue.current) {
      desc += `**⸻ NOW PLAYING**\n[${queue.current.title}](${queue.current.url}) [${queue.current.duration}]\nRequested by: ${queue.current.requester}\n\n`;
      if (queue.songs.length > 0) {
        desc += `**⸻ NEXT UP**\n[${queue.songs[0].title}](${queue.songs[0].url}) [${queue.songs[0].duration}]\n`;
        if (queue.songs.length > 1) desc += `...and ${queue.songs.length - 1} more in queue.\n`;
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
    
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_repeat').setLabel(queue.repeatTrack ? 'Repeat: ON' : 'Repeat: OFF').setStyle(queue.repeatTrack ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_lyrics').setLabel('Lyrics').setStyle(ButtonStyle.Primary)
    );
    
    await message.edit({ embeds: [embed], components: [row, row2] });
  } catch (error) {
    console.error(`Failed to update music UI for guild ${guildId}:`, error);
  }
}

export async function handleInteraction(interaction) {
  const queue = getQueue(interaction.guildId);
  const action = interaction.customId.replace('music_', '');
  
  if (action === 'play') {
    if (!queue.current) return interaction.reply({ content: `There is no music playing.`, ephemeral: true });
    if (queue.player && queue.player.paused) {
      queue.player.setPaused(false);
      await interaction.reply({ content: `${interaction.user} resumed the playback.` });
      setTimeout(() => interaction.deleteReply().catch(()=>null), 5000);
      broadcastAction(interaction.guildId, interaction.user, 'resumed the playback');
    } else {
      await interaction.reply({ content: `The music is already playing.`, ephemeral: true });
    }
  } else if (action === 'pause') {
    if (!queue.current) return interaction.reply({ content: `There is no music playing.`, ephemeral: true });
    if (queue.player && !queue.player.paused) {
      queue.player.setPaused(true);
      await interaction.reply({ content: `${interaction.user} paused the playback.` });
      setTimeout(() => interaction.deleteReply().catch(()=>null), 5000);
      broadcastAction(interaction.guildId, interaction.user, 'paused the playback');
    } else {
      await interaction.reply({ content: `The music is already paused.`, ephemeral: true });
    }
  } else if (action === 'skip') {
    if (!queue.current) return interaction.reply({ content: `There is nothing to skip.`, ephemeral: true });
    if (queue.player) queue.player.stopTrack(); // Triggers 'end' event which plays next
    await interaction.reply({ content: `${interaction.user} skipped **${queue.current.title}**.` });
    setTimeout(() => interaction.deleteReply().catch(()=>null), 5000);
    broadcastAction(interaction.guildId, interaction.user, `skipped **${queue.current.title}**`);
  } else if (action === 'stop') {
    queue.songs = [];
    queue.current = null;
    if (queue.player) queue.player.stopTrack();
    await interaction.reply({ content: `${interaction.user} stopped the music and cleared the queue.` });
    setTimeout(() => interaction.deleteReply().catch(()=>null), 5000);
    clearNowPlayingEmbeds(interaction.guildId);
    broadcastAction(interaction.guildId, interaction.user, 'stopped the music and cleared the queue');
    startLeaveTimeout(interaction.guildId);
  } else if (action === 'queue') {
    if (queue.songs.length === 0) return interaction.reply({ content: `The queue is currently empty.`, ephemeral: true });
    const qList = queue.songs.slice(0, 10).map((s, i) => `${i + 1}. **${s.title}** [${s.duration}]`).join('\n');
    let msg = `**Current Queue:**\n${qList}`;
    if (queue.songs.length > 10) msg += `\n*...and ${queue.songs.length - 10} more*`;
    return interaction.reply({ content: msg, ephemeral: true });
  } else if (action === 'repeat') {
    queue.repeatTrack = !queue.repeatTrack;
    updatePlayerUI(interaction.guildId);
    return interaction.reply({ content: `Track repeating is now **${queue.repeatTrack ? 'ON' : 'OFF'}**.`, ephemeral: true });
  } else if (action === 'lyrics') {
    const cleanSongTitle = (title) => {
      if (!title) return '';
      return title
        .replace(/\[.*?\]|\(.*?\)|\{.*?\}/g, '')
        .replace(/official video|official lyric video|official music video|official audio|music video|lyric video|lyrics|audio|m\/v|mv|hd|hq|ft\.|feat\./gi, '')
        .replace(/[\u3131-\uD79D]/g, '') 
        .replace(/-|\||:/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const defaultTitle = queue.current ? cleanSongTitle(queue.current.title) : '';
    
    const modal = new ModalBuilder()
      .setCustomId('music_lyrics_modal')
      .setTitle('Search Lyrics');

    const songInput = new TextInputBuilder()
      .setCustomId('song_name')
      .setLabel('Song Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(defaultTitle);

    const firstActionRow = new ActionRowBuilder().addComponents(songInput);
    modal.addComponents(firstActionRow);
    
    await interaction.showModal(modal);
  }
}
