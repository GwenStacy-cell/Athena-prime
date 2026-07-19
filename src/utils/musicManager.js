import fs from 'fs';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } from 'discord.js';
import { createCanvas } from 'canvas';
import { getVoiceConnection } from '@discordjs/voice';
import db from '../database.js';
import { connectToHomeVc } from './voice.js';
import { fetchSpotifyData } from './spotify.js';

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
      nowPlayingMsgVcId: null,
      progressInterval: null,
      autoplay: false,
      history: []
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
       if (guild) setTimeout(() => connectToHomeVc(guild, cfg.homeVcId), 2000);
    }
  }, 1000);
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
      
      // If Shoukaku thinks it has a player but the bot was manually disconnected, clean it up first
      if (player && !guild.members.me.voice.channelId) {
         await shoukaku.leaveVoiceChannel(guild.id);
         await new Promise(r => setTimeout(r, 500));
         player = null;
      }

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
      queue.player.setGlobalVolume(queue.volume);
      
      // Apply High-Fidelity EQ for better audio clarity
      queue.player.setEqualizer([
        { band: 0, gain: 0.15 }, // Bass
        { band: 1, gain: 0.10 }, // Bass
        { band: 2, gain: 0.05 }, // Low-mid
        { band: 12, gain: 0.05 }, // High-mid
        { band: 13, gain: 0.10 }, // Treble
        { band: 14, gain: 0.10 }  // Treble
      ]);
      
      
      queue.player.on('end', async (data) => {
        if (data && data.reason === 'REPLACED') return;
        
        if (queue.progressInterval) {
          clearInterval(queue.progressInterval);
          queue.progressInterval = null;
        }
        
        if (queue.current) {
          queue.history.push(queue.current);
          if (queue.history.length > 50) queue.history.shift();
        }

        if (queue.repeatTrack && queue.current) {
          queue.songs.unshift(queue.current);
        }
        
        if (queue.songs.length > 0) {
          queue.current = queue.songs.shift();
          playResource(guild.id, queue.current);
        } else if (queue.autoplay) {
          // Autoplay logic
          const shoukaku = global.client.shoukaku;
          const node = shoukaku.options.nodeResolver(shoukaku.nodes);
          if (node) {
             let nextSong = null;
             
             // First try to fetch a random liked song from any user in VC
             try {
                const currentGuild = global.client.guilds.cache.get(guild.id);
                const botVcId = currentGuild.members.me.voice.channelId;
                const vc = global.client.channels.cache.get(botVcId) || await global.client.channels.fetch(botVcId);
                if (vc && vc.members) {
                   const members = Array.from(vc.members.values()).filter(m => !m.user.bot);
                   for (const member of members.sort(() => 0.5 - Math.random())) {
                                            const likedSongs = db.getLikedSongs(member.id);
                      if (likedSongs && likedSongs.length > 0) {
                         // Find one not in history recently
                         const unplayed = likedSongs.filter(ls => !queue.history.slice(-10).some(h => h.url === ls.url));
                         if (unplayed.length > 0) {
                            const chosen = unplayed[Math.floor(Math.random() * unplayed.length)];
                            let result = await node.rest.resolve(chosen.encoded ? chosen.encoded : `ytmsearch:${chosen.title}`);
                            if (result && result.loadType === 'track') {
                               nextSong = result.data;
                               nextSong.requester = global.client.user;
                               break;
                            }
                         }
                      }
                   }
                }
             } catch(e) {}
             
             
             // Fallback to highly relevant related tracks using YouTube Music
             if (!nextSong && queue.current) {
                try {
                   // Clean title for search
                   const cleanTitle = queue.current.title.replace(/\[.*?\]|\(.*?\)|\{.*?\}/g, '').split('|')[0].trim();
                   const author = queue.current.author ? queue.current.author.replace(/- Topic/i, '').trim() : '';
                   
                   // Fetch related tracks by searching for the same artist or similar vibe
                   let result = await node.rest.resolve(`ytmsearch:${author} mix audio`);
                   if (!result || result.loadType !== 'search' || result.data.length === 0) {
                      result = await node.rest.resolve(`ytmsearch:${author} top tracks audio`);
                   }
                   
                   if (result && result.loadType === 'search') {
                      // Filter out what was just played recently
                      const historyUrls = queue.history.slice(-15).map(h => h.url);
                      historyUrls.push(queue.current.url);
                      
                      const tracks = result.data.filter(t => !historyUrls.includes(t.info.uri));
                      if (tracks.length > 0) {
                         nextSong = tracks[0];
                         nextSong.requester = global.client.user;
                      }
                   }
                } catch(e) { console.error('Autoplay related search failed', e); }
             }

             
             if (nextSong) {
                const getThumbnail = (track) => {
                  if (track.info.artworkUrl) return track.info.artworkUrl;
                  if (track.info.uri && track.info.uri.includes('youtube.com/watch?v=')) {
                    const videoId = track.info.uri.split('v=')[1].split('&')[0];
                    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                  }
                  return null;
                };
                
                queue.songs.push({
                  title: nextSong.info.title,
                  url: nextSong.info.uri,
                  duration: formatDuration(nextSong.info.length),
                  encoded: nextSong.encoded,
                  artworkUrl: getThumbnail(nextSong),
                  requester: global.client.user,
                  author: nextSong.info.author
                });
                
                queue.current = queue.songs.shift();
                playResource(guild.id, queue.current);
                return;
             }
          }
          queue.current = null;
          queue.isPlaying = false;
          updatePlayerUI(guild.id);
          clearNowPlayingEmbeds(guild.id);
          startLeaveTimeout(guild.id);
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

      queue.player.on('closed', (data) => {
        // Voice channel closed or bot disconnected manually
        if (data.code === 4014 || data.code === 4006 || data.code === 4009) {
          queue.player = null;
          queue.isPlaying = false;
          queue.current = null;
          queue.songs = [];
          updatePlayerUI(guild.id);
          clearNowPlayingEmbeds(guild.id);
        }
      });
    }
    
    const node = shoukaku.options.nodeResolver(shoukaku.nodes);
    if (!node) {
      queue.isPreparing = false;
      return { success: false, message: 'No available Lavalink nodes.' };
    }
    
    
    let searchStr = query;
    let fallbackSearch = null;
    
    // Native Spotify Integration
    if (query.includes('spotify.com/')) {
       try {
          const spotifyData = await fetchSpotifyData(query);
          if (spotifyData) {
             if (spotifyData.type === 'track') {
                searchStr = spotifyData.queries[0];
                fallbackSearch = searchStr;
             } else if (spotifyData.type === 'playlist') {
                const firstQuery = spotifyData.queries.shift();
                searchStr = firstQuery;
                fallbackSearch = firstQuery;
                
                // Background async loading for the rest to avoid interaction timeout
                setTimeout(async () => {
                   let count = 0;
                   for (const q of spotifyData.queries) {
                       let res = await node.rest.resolve(q);
                       if (res && res.loadType === 'search') {
                          const t = res.data[0];
                          queue.songs.push({
                            title: t.info.title,
                            url: t.info.uri,
                            duration: formatDuration(t.info.length),
                            encoded: t.encoded,
                            artworkUrl: getThumbnail(t),
                            requester: member.user,
                            author: t.info.author
                          });
                          count++;
                       }
                       // Avoid Lavalink ratelimits when resolving hundreds of tracks
                       await new Promise(r => setTimeout(r, 200));
                   }
                   if (count > 0 && queue.textChannel) {
                       const tc = global.client.channels.cache.get(queue.textChannel);
                       if (tc) tc.send(`✅ Finished loading **${count}** remaining tracks from **${spotifyData.title}**!`);
                   }
                }, 1000);
             }
          }
       } catch (e) {
          console.error('Spotify native fetch failed:', e);
       }
    } else if (!query.startsWith('http')) {
      searchStr = `ytsearch:${query}`; // Default to standard YouTube search for accuracy
      fallbackSearch = `ytmsearch:${query}`;
    }
    
    let result = await node.rest.resolve(searchStr);
    
    // Fallback if not found
    if (!result || (result.loadType !== 'track' && result.loadType !== 'playlist' && result.loadType !== 'search')) {
      if (fallbackSearch) {
         result = await node.rest.resolve(fallbackSearch);
      }
    }

    if (!result || (result.loadType !== 'track' && result.loadType !== 'playlist' && result.loadType !== 'search')) {
      if (searchStr.startsWith('spsearch:')) {
         searchStr = `ytsearch:${query}`;
         result = await node.rest.resolve(searchStr);
      }
    }
    
    const getThumbnail = (track) => {
      if (track.info.artworkUrl) return track.info.artworkUrl;
      if (track.info.uri && track.info.uri.includes('youtube.com/watch?v=')) {
        const videoId = track.info.uri.split('v=')[1].split('&')[0];
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
      return null;
    };
    
    let searchResult = result;
    
    if (!searchResult || (searchResult.loadType !== 'track' && searchResult.loadType !== 'playlist' && searchResult.loadType !== 'search')) {
       queue.isPreparing = false;
       return { success: false, message: 'No results found for that query.' };
    }
    
    let addedCount = 0;
    let title = '';
    
    if (searchResult.loadType === 'playlist') {
       for (const track of searchResult.data.tracks) {
          queue.songs.push({
            title: track.info.title,
            url: track.info.uri,
            duration: formatDuration(track.info.length),
            encoded: track.encoded,
            artworkUrl: getThumbnail(track),
            requester: member.user,
          author: track.info.author
       });
       }
       addedCount = searchResult.data.tracks.length;
       title = searchResult.data.info.name || 'Playlist';
    } else if (searchResult.loadType === 'track') {
       const track = searchResult.data;
       queue.songs.push({
          title: track.info.title,
          url: track.info.uri,
          duration: formatDuration(track.info.length),
          encoded: track.encoded,
          artworkUrl: getThumbnail(track),
          requester: member.user,
          author: track.info.author
       });
       addedCount = 1;
       title = track.info.title;
    } else if (searchResult.loadType === 'search') {
       const track = searchResult.data[0];
       queue.songs.push({
          title: track.info.title,
          url: track.info.uri,
          duration: formatDuration(track.info.length),
          encoded: track.encoded,
          artworkUrl: getThumbnail(track),
          requester: member.user,
          author: track.info.author
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

        const cfg = db.getGuildConfig(guild.id);
    const accent = cfg.accentColor || '#ff0000';
    
    return { 
      success: true, 
      trackObj: queue.current || queue.songs[queue.songs.length - 1],
      message: `Added **${title}** to queue.`
    };

  } catch (error) {
    console.error(`Music enqueue error:`, error);
    queue.isPreparing = false;
    if (error.message && error.message.includes("Can't find any nodes")) {
      return { success: false, message: `Music systems are currently connecting or all nodes are offline. Please try again in 15 seconds!` };
    }
    return { success: false, message: `An error occurred: ${error.message}` };
  }
}

async function playResource(guildId, song) {
  const queue = getQueue(guildId);
  try {
    if (queue.player && song.encoded) {
       queue.player.playTrack({ track: { encoded: song.encoded } }).catch(console.error);
       queue.isPlaying = true;
       
       if (queue.progressInterval) clearInterval(queue.progressInterval);
       queue.progressInterval = setInterval(() => {
          if (queue.isPlaying) updateNowPlayingEmbeds(guildId);
       }, 10000);
       
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


async function generateNowPlayingImage(track, currentMs, totalMs, hexColor) {
  // createCanvas and loadImage are imported globally (wait, loadImage is not. Let's use dynamic import)
  const { createCanvas, loadImage } = await import('canvas');
  const canvas = createCanvas(800, 250);
  const ctx = canvas.getContext('2d');
  
  ctx.clearRect(0, 0, 800, 250);

  const drawCard = (x, y, w, h, radius, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  };
  
  const cardColor = '#111214'; 
  drawCard(0, 0, 520, 130, 20, cardColor);
  drawCard(0, 150, 520, 100, 20, cardColor);
  drawCard(540, 0, 260, 250, 20, cardColor);

  if (track.artworkUrl) {
    try {
      const img = await loadImage(track.artworkUrl);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(540 + 20, 0);
      ctx.lineTo(540 + 260 - 20, 0);
      ctx.quadraticCurveTo(540 + 260, 0, 540 + 260, 20);
      ctx.lineTo(540 + 260, 250 - 20);
      ctx.quadraticCurveTo(540 + 260, 250, 540 + 260 - 20, 250);
      ctx.lineTo(540 + 20, 250);
      ctx.quadraticCurveTo(540, 250, 540, 250 - 20);
      ctx.lineTo(540, 20);
      ctx.quadraticCurveTo(540, 0, 540 + 20, 0);
      ctx.clip();
      
      const scale = Math.max(260 / img.width, 250 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = 540 + (260 - w) / 2;
      const y = (250 - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
    } catch (e) { console.error('Failed to load artwork for canvas', e); }
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  let titleStr = track.title || 'Unknown Title';
  if (titleStr.length > 25) titleStr = titleStr.substring(0, 25) + '...';
  ctx.fillText(titleStr, 30, 55);

  ctx.fillStyle = '#b9bbbe';
  ctx.font = '24px sans-serif';
  let authorStr = `By ${track.author || 'Unknown'}`;
  if (authorStr.length > 35) authorStr = authorStr.substring(0, 35) + '...';
  ctx.fillText(authorStr, 30, 100);

  const barWidth = 440;
  const barX = 40;
  const barY = 200;
  const trackHeight = 10;
  const knobRadius = 12;
  
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.roundRect(barX, barY - trackHeight/2, barWidth, trackHeight, trackHeight/2);
  ctx.fill();
  
  const progress = totalMs > 0 ? Math.min(Math.max(currentMs / totalMs, 0), 1) : 0;
  const fillWidth = barWidth * progress;
  
  if (fillWidth > 0) {
    ctx.fillStyle = hexColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY - trackHeight/2, fillWidth, trackHeight, trackHeight/2);
    ctx.fill();
  }
  
  ctx.fillStyle = hexColor;
  ctx.beginPath();
  ctx.arc(barX + fillWidth, barY, knobRadius, 0, Math.PI * 2);
  ctx.fill();
  
  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(formatTime(currentMs), barX, barY + 30);
  
  const totalStr = formatTime(totalMs);
  const totalW = ctx.measureText(totalStr).width;
  ctx.fillText(totalStr, barX + barWidth - totalW, barY + 30);

  return canvas.toBuffer('image/png');
}





async function updateNowPlayingEmbeds(guildId) {
  const queue = getQueue(guildId);
  if (!queue.current || !queue.isPlaying) return;
  
  const cfg = db.getGuildConfig(guildId);
  
  // Calculate total duration in ms
  const [mins, secs] = queue.current.duration.split(':').map(Number);
  const totalMs = queue.current.duration === 'Unknown' ? 0 : (mins * 60 + secs) * 1000;
  
  const imgBuffer = await generateNowPlayingImage(queue.current, queue.player?.position || 0, totalMs, cfg.accentColor || '#ff0000');
  const attachment = new AttachmentBuilder(imgBuffer, { name: 'progress.png' });
  
  if (queue.player) {
     try {
       const guild = global.client.guilds.cache.get(guildId);
       const vcId = guild.members.me.voice?.channelId;
       const vc = guild.channels.cache.get(vcId);
       if (vc && vc.isTextBased()) {
         const nowPlayingEmbed = buildAddedToQueueMsg(queue.current, cfg.accentColor).embeds[0];
         nowPlayingEmbed.data.title = "🎶 Now Playing"; // Differentiate from "Added to Queue"
         
         const embedsToSend = [nowPlayingEmbed];
         if (cfg.musicChannelId && vc.id !== cfg.musicChannelId) {
            const controlEmbed = new EmbedBuilder()
              .setColor(cfg.accentColor || '#ff0000')
              .setDescription(`-# **[Control Playback Here](https://discord.com/channels/${guildId}/${cfg.musicChannelId})**\n-# If you want to pause, skip, or change volume, head over to <#${cfg.musicChannelId}>!`);
            embedsToSend.push(controlEmbed);
         }

         if (queue.nowPlayingMsgVcId) {
            try {
              const msg = await vc.messages.fetch(queue.nowPlayingMsgVcId);
              if (msg) await msg.edit({ embeds: embedsToSend, files: [attachment] });
            } catch (e) {
              const newMsg = await vc.send({ embeds: embedsToSend, files: [attachment] }).catch(()=>null);
              if (newMsg) queue.nowPlayingMsgVcId = newMsg.id;
            }
         } else {
            const newMsg = await vc.send({ embeds: embedsToSend, files: [attachment] }).catch(()=>null);
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
    
    const isPaused = queue.player && queue.player.paused;
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_prev').setLabel('Prev').setStyle(ButtonStyle.Secondary).setEmoji('⏮️'),
      new ButtonBuilder().setCustomId('music_pause').setLabel(isPaused ? 'Resume' : 'Pause').setStyle(ButtonStyle.Secondary).setEmoji(isPaused ? '<:play:1528165307150241852>' : '<:pause_:1528165159686770740>'),
      new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setStyle(ButtonStyle.Secondary).setEmoji('<:skip:1528165408807588050>')
    );
    
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setStyle(ButtonStyle.Secondary).setEmoji('<:stop:1528165509508632821>')
    );
    
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_like').setLabel('Like').setStyle(ButtonStyle.Secondary).setEmoji('🤍'),
      new ButtonBuilder().setCustomId('music_autoplay').setLabel(queue.autoplay ? 'Autoplay (ON)' : 'Autoplay').setStyle(ButtonStyle.Secondary).setEmoji('<:autoplay:1524695881339764767>'),
      new ButtonBuilder().setCustomId('music_repeat').setLabel(queue.repeatTrack ? 'Replay (ON)' : 'Replay').setStyle(ButtonStyle.Secondary).setEmoji('🔁')
    );

    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_voldown').setLabel('Vol-').setStyle(ButtonStyle.Secondary).setEmoji('<:volumedown:1528156479075516526>'),
      new ButtonBuilder().setCustomId('music_volreset').setLabel(`${queue.volume}%`).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_volup').setLabel('Vol+').setStyle(ButtonStyle.Secondary).setEmoji('<:volume:1524687855354380359>')
    );
    
    await message.edit({ embeds: [embed], components: [row1, row2, row3, row4], files: [] });
  } catch (error) {
    console.error(`Failed to update music UI for guild ${guildId}:`, error);
  }
}


export async function handleInteraction(interaction) {
  const queue = getQueue(interaction.guildId);
  const action = interaction.customId.replace('music_', '');
  
  const announceToVC = async (text) => {
     try {
       const guild = interaction.guild;
       const vcId = guild.members.me.voice?.channelId;
       const vc = guild.channels.cache.get(vcId);
       if (vc && vc.isTextBased()) {
         const cfg = db.getGuildConfig(guild.id);
         const embed = new EmbedBuilder()
           .setColor(cfg.accentColor || '#ff0000')
           .setDescription(text);
         await vc.send({ embeds: [embed] }).catch(()=>null);
       }
     } catch(e) {}
  };
  
  if (action === 'play') {
    // legacy support if button still exists
  } else if (action === 'pause') {
    if (!queue.current) return interaction.reply({ content: `There is no music playing.`, flags: 64 });
    if (queue.player) {
      await queue.player.setPaused(!queue.player.paused);
      updatePlayerUI(interaction.guildId);
      await interaction.reply({ content: queue.player.paused ? `Playback paused.` : `Playback resumed.`, flags: 64 });
      const emoji = queue.player.paused ? '<:pause_:1528165159686770740>' : '<:play:1528165307150241852>';
      announceToVC(`${emoji} **${interaction.user.displayName}** ${queue.player.paused ? 'paused' : 'resumed'} the playback.`);
    }
  } else if (action === 'skip') {
    if (!queue.current) return interaction.reply({ content: `There is nothing to skip.`, flags: 64 });
    if (queue.player) await queue.player.stopTrack(); // Triggers 'end' event which plays next
    await interaction.reply({ content: `Skipped track.`, flags: 64 });
    announceToVC(`<:skip:1528165408807588050> **${interaction.user.displayName}** skipped the track.`);
  } else if (action === 'prev') {
    if (queue.history.length === 0) return interaction.reply({ content: `No previous tracks.`, flags: 64 });
    queue.songs.unshift(queue.history.pop());
    if (queue.player) await queue.player.stopTrack();
    await interaction.reply({ content: `Playing previous track.`, flags: 64 });
    announceToVC(`⏮️ **${interaction.user.displayName}** returned to the previous track.`);
  } else if (action === 'stop') {
    queue.songs = [];
    queue.history = [];
    if (queue.player) await queue.player.stopTrack();
    updatePlayerUI(interaction.guildId);
    await interaction.reply({ content: `Stopped playback and cleared queue.`, flags: 64 });
    announceToVC(`<:stop:1528165509508632821> **${interaction.user.displayName}** stopped the playback and cleared the queue.`);
  } else if (action === 'repeat') {
    queue.repeatTrack = !queue.repeatTrack;
    updatePlayerUI(interaction.guildId);
    await interaction.reply({ content: `Repeat is now **${queue.repeatTrack ? 'ON' : 'OFF'}**.`, flags: 64 });
    announceToVC(`🔁 **${interaction.user.displayName}** turned repeat **${queue.repeatTrack ? 'ON' : 'OFF'}**.`);
  } else if (action === 'autoplay') {
    queue.autoplay = !queue.autoplay;
    updatePlayerUI(interaction.guildId);
    await interaction.reply({ content: `Autoplay is now **${queue.autoplay ? 'ON' : 'OFF'}**.`, flags: 64 });
    announceToVC(`<:autoplay:1524695881339764767> **${interaction.user.displayName}** turned autoplay **${queue.autoplay ? 'ON' : 'OFF'}**.`);
  } else if (action === 'like') {
    if (!queue.current) return interaction.reply({ content: `Nothing is playing to like!`, flags: 64 });
    const added = db.toggleLikedSong(interaction.user.id, queue.current);
    await interaction.reply({ content: added ? `🤍 Added **${queue.current.title}** to your Liked Songs! (Autoplay will prioritize these)` : `Removed from Liked Songs.`, flags: 64 });
    if (added) announceToVC(`🤍 **${interaction.user.displayName}** liked the current song!`);
  } else if (action === 'voldown') {
    queue.volume = Math.max(0, queue.volume - 10);
    if (queue.player) queue.player.setGlobalVolume(queue.volume);
    updatePlayerUI(interaction.guildId);
    await interaction.reply({ content: `Volume decreased to ${queue.volume}%`, flags: 64 });
    announceToVC(`<:volumedown:1528156479075516526> **${interaction.user.displayName}** decreased the volume to **${queue.volume}%**.`);
  } else if (action === 'volup') {
    queue.volume = Math.min(200, queue.volume + 10);
    if (queue.player) queue.player.setGlobalVolume(queue.volume);
    updatePlayerUI(interaction.guildId);
    await interaction.reply({ content: `Volume increased to ${queue.volume}%`, flags: 64 });
    announceToVC(`<:volume:1524687855354380359> **${interaction.user.displayName}** increased the volume to **${queue.volume}%**.`);
  } else if (action === 'volreset') {
    queue.volume = 100;
    if (queue.player) queue.player.setGlobalVolume(queue.volume);
    updatePlayerUI(interaction.guildId);
    await interaction.reply({ content: `Volume reset to 100%`, flags: 64 });
    announceToVC(`🔊 **${interaction.user.displayName}** reset the volume to **100%**.`);
  } else if (action === 'lyrics') {
     // Lyrics modal code
  }
}


export function buildAddedToQueueMsg(track, accentColor = '#ff0000') {
    const embed = new EmbedBuilder()
    .setColor(accentColor);
    
  let desc = `# <:music:1528159649780732046> [${track.title.substring(0, 100)}](${track.url})\n`;
  desc += `By ${track.author || 'Unknown'}\n\n`;
  
  const platformIcon = track.url.includes('spotify') ? '<:spotify:1528161641601044690>' : '<:ytlogo:1528154904944709722>';
  desc += `${platformIcon} • ${track.duration} • <:author:1524687847662161971> <@${track.requester.id}>`;
  
  embed.setDescription(desc);
  if (track.artworkUrl) {
    embed.setThumbnail(track.artworkUrl);
  }
  
  return { embeds: [embed] };
}
