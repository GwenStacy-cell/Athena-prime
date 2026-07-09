import fs from 'fs';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } from 'discord.js';
import { createCanvas } from 'canvas';
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
      queue.player.setGlobalVolume(queue.volume);
      
      
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
                      const db = require('../database.js').default;
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
                   let result = await node.rest.resolve(`ytmsearch:${cleanTitle} ${author} related`);
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
    }
    
    const node = shoukaku.options.nodeResolver(shoukaku.nodes);
    if (!node) {
      queue.isPreparing = false;
      return { success: false, message: 'No available Lavalink nodes.' };
    }
    
    
    let searchStr = query;
    let fallbackSearch = null;
    
    // Spotify scraper fallback for better accuracy
    if (query.includes('spotify.com/track/')) {
       try {
          const fetch = (await import('node-fetch')).default;
          const cheerio = require('cheerio');
          const res = await fetch(query);
          const html = await res.text();
          const $ = cheerio.load(html);
          const title = $('meta[property="og:title"]').attr('content');
          const desc = $('meta[property="og:description"]').attr('content');
          if (title) {
             const artist = desc ? desc.split('·')[0].trim() : '';
             searchStr = `ytmsearch:${title} ${artist} audio`;
             fallbackSearch = `ytsearch:${title} ${artist} audio`;
          }
       } catch (e) {
          console.error('Spotify scraper failed:', e);
       }
    } else if (!query.startsWith('http')) {
      searchStr = `ytmsearch:${query} audio`; // Add audio to get exact tracks, avoid music videos
      fallbackSearch = `ytsearch:${query} audio`;
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

    const { EmbedBuilder } = require('discord.js');
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

function generateProgressBarImage(currentMs, totalMs, hexColor) {
  const canvas = createCanvas(800, 75);
  const ctx = canvas.getContext('2d');
  
  const progress = totalMs > 0 ? Math.min(Math.max(currentMs / totalMs, 0), 1) : 0;
  const barWidth = 760;
  const x = 20;
  const y = 20;
  const trackHeight = 6;
  const knobRadius = 10;
  
  // Background track (dark grey)
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.roundRect(x, y - trackHeight/2, barWidth, trackHeight, trackHeight/2);
  ctx.fill();
  
  // Filled track (accent color)
  const fillWidth = barWidth * progress;
  if (fillWidth > 0) {
    ctx.fillStyle = hexColor;
    ctx.beginPath();
    ctx.roundRect(x, y - trackHeight/2, fillWidth, trackHeight, trackHeight/2);
    ctx.fill();
  }
  
  // Knob
  ctx.fillStyle = hexColor;
  ctx.beginPath();
  ctx.arc(x + fillWidth, y, knobRadius, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Timestamps
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#a1a1aa';
  ctx.textBaseline = 'top';
  
  const currentText = formatDuration(currentMs);
  const totalText = totalMs > 0 ? formatDuration(totalMs) : 'LIVE';
  
  ctx.textAlign = 'left';
  ctx.fillText(currentText, x, y + 25);
  
  ctx.textAlign = 'right';
  ctx.fillText(totalText, x + barWidth, y + 25);
  
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
         if (queue.nowPlayingMsgVcId) {
            try {
              const msg = await vc.messages.fetch(queue.nowPlayingMsgVcId);
              // Send JUST the attachment as requested (no embed)
              if (msg) await msg.edit({ embeds: [], files: [attachment] });
            } catch (e) {
              const newMsg = await vc.send({ embeds: [], files: [attachment] }).catch(()=>null);
              if (newMsg) queue.nowPlayingMsgVcId = newMsg.id;
            }
         } else {
            const newMsg = await vc.send({ embeds: [], files: [attachment] }).catch(()=>null);
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
    
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_prev').setLabel('Prev').setStyle(ButtonStyle.Secondary).setEmoji('⏮️'),
      new ButtonBuilder().setCustomId('music_pause').setLabel(queue.player && queue.player.paused ? 'Resume' : 'Pause').setStyle(ButtonStyle.Primary).setEmoji('⏯️'),
      new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setStyle(ButtonStyle.Secondary).setEmoji('⏭️')
    );
    
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️')
    );
    
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_like').setLabel('Like').setStyle(ButtonStyle.Secondary).setEmoji('🤍'),
      new ButtonBuilder().setCustomId('music_autoplay').setLabel('Autoplay').setStyle(queue.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('<:autoplay:1524695881339764767>'),
      new ButtonBuilder().setCustomId('music_repeat').setLabel('Replay').setStyle(queue.repeatTrack ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('🔁')
    );

    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_voldown').setLabel('Vol-').setStyle(ButtonStyle.Danger).setEmoji('<:volume:1524687855354380359>'),
      new ButtonBuilder().setCustomId('music_volreset').setLabel(`${queue.volume}%`).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_volup').setLabel('Vol+').setStyle(ButtonStyle.Success).setEmoji('<:volume:1524687855354380359>')
    );
    
    await message.edit({ embeds: [embed], components: [row1, row2, row3, row4], files: [] });
  } catch (error) {
    console.error(`Failed to update music UI for guild ${guildId}:`, error);
  }
}


export async function handleInteraction(interaction) {
  const queue = getQueue(interaction.guildId);
  const action = interaction.customId.replace('music_', '');
  
  if (action === 'play') {
    // legacy support if button still exists
  } else if (action === 'pause') {
    if (!queue.current) return interaction.reply({ content: `There is no music playing.`, ephemeral: true });
    if (queue.player) {
      queue.player.setPaused(!queue.player.paused);
      updatePlayerUI(interaction.guildId);
      await interaction.reply({ content: queue.player.paused ? `Playback paused.` : `Playback resumed.`, ephemeral: true });
    }
  } else if (action === 'skip') {
    if (!queue.current) return interaction.reply({ content: `There is nothing to skip.`, ephemeral: true });
    if (queue.player) queue.player.stopTrack(); // Triggers 'end' event which plays next
    await interaction.reply({ content: `Skipped track.`, ephemeral: true });
  } else if (action === 'prev') {
    if (queue.history.length === 0) return interaction.reply({ content: `No previous tracks.`, ephemeral: true });
    queue.songs.unshift(queue.history.pop());
    if (queue.player) queue.player.stopTrack();
    await interaction.reply({ content: `Playing previous track.`, ephemeral: true });
  } else if (action === 'stop') {
    queue.songs = [];
    queue.history = [];
    if (queue.player) queue.player.stopTrack();
    updatePlayerUI(interaction.guildId);
    await interaction.reply({ content: `Stopped playback and cleared queue.`, ephemeral: true });
  } else if (action === 'repeat') {
    queue.repeatTrack = !queue.repeatTrack;
    updatePlayerUI(interaction.guildId);
    return interaction.reply({ content: `Repeat is now **${queue.repeatTrack ? 'ON' : 'OFF'}**.`, ephemeral: true });
  } else if (action === 'autoplay') {
    queue.autoplay = !queue.autoplay;
    updatePlayerUI(interaction.guildId);
    return interaction.reply({ content: `Autoplay is now **${queue.autoplay ? 'ON' : 'OFF'}**.`, ephemeral: true });
  } else if (action === 'like') {
    if (!queue.current) return interaction.reply({ content: `Nothing is playing to like!`, ephemeral: true });
    const db = require('../database.js').default;
    const added = db.toggleLikedSong(interaction.user.id, queue.current);
    return interaction.reply({ content: added ? `🤍 Added **${queue.current.title}** to your Liked Songs! (Autoplay will prioritize these)` : `Removed from Liked Songs.`, ephemeral: true });
  } else if (action === 'voldown') {
    queue.volume = Math.max(0, queue.volume - 10);
    if (queue.player) queue.player.setGlobalVolume(queue.volume);
    updatePlayerUI(interaction.guildId);
    return interaction.reply({ content: `Volume decreased to ${queue.volume}%`, ephemeral: true });
  } else if (action === 'volup') {
    queue.volume = Math.min(200, queue.volume + 10);
    if (queue.player) queue.player.setGlobalVolume(queue.volume);
    updatePlayerUI(interaction.guildId);
    return interaction.reply({ content: `Volume increased to ${queue.volume}%`, ephemeral: true });
  } else if (action === 'volreset') {
    queue.volume = 100;
    if (queue.player) queue.player.setGlobalVolume(queue.volume);
    updatePlayerUI(interaction.guildId);
    return interaction.reply({ content: `Volume reset to 100%`, ephemeral: true });
  } else if (action === 'lyrics') {
     // Lyrics modal code
  }
}


export function buildAddedToQueueMsg(track, accentColor = '#ff0000') {
  const { EmbedBuilder } = require('discord.js');
  const embed = new EmbedBuilder()
    .setColor(accentColor);
    
  let desc = `# 🎵 [${track.title.substring(0, 100)}](${track.url})\n`;
  desc += `By ${track.author || 'Unknown'}\n\n`;
  
  const platformIcon = track.url.includes('spotify') ? '<:spotify:123> Spotify' : '▶️ YouTube';
  desc += `${platformIcon} • ${track.duration} • 🔴 <@${track.requester.id}>`;
  
  embed.setDescription(desc);
  if (track.artworkUrl) {
    embed.setThumbnail(track.artworkUrl);
  }
  
  return { embeds: [embed] };
}
