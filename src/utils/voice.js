import { PermissionFlagsBits } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice';
import db from '../database.js';

const reconnectTimeouts = new Map();

/**
 * Connect the bot to its designated Home VC in a guild
 */
export async function connectToHomeVc(guild, channelId, force = false) {
  if (!guild || !channelId) return null;

  // Prevent rapid reconnect loops unless forced (e.g. on startup)
  if (!force) {
    if (reconnectTimeouts.has(guild.id)) return null;
    reconnectTimeouts.set(guild.id, true);
    setTimeout(() => reconnectTimeouts.delete(guild.id), 3000);
  }

  let channel = guild.channels.cache.get(channelId);
  if (!channel) {
    try {
      channel = await guild.channels.fetch(channelId);
    } catch(e) {}
  }

  if (!channel) {
    console.error(`[Athena Prime] Home Voice Channel ${channelId} not found in guild ${guild.name}`);
    return null;
  }

  try {
    let connection = getVoiceConnection(guild.id);
    if (!connection || connection.joinConfig.channelId !== channel.id) {
       connection = joinVoiceChannel({
         channelId: channel.id,
         guildId: guild.id,
         adapterCreator: guild.voiceAdapterCreator,
         selfDeaf: false,
         selfMute: false
       });
       console.log(`[Athena Prime] Joined Home VC "${channel.name}" in guild "${guild.name}" via native voice`);
    }
    return connection;
  } catch (error) {
    console.error(`[Athena Prime] Failed to join Home VC in guild ${guild.name}:`, error);
    return null;
  }
}

/**
 * Toggle the bot's OWN self-deafen by updating the voice connection.
 */
export async function toggleBotDeafen(guild, deaf) {
  try {
    const me = guild.members.me;
    if (!me || !me.voice?.channelId) {
      return { success: false, message: 'The bot is not currently in a voice channel.' };
    }

    const shoukaku = global.client?.shoukaku;
    if (shoukaku) {
      const player = shoukaku.players.get(guild.id);
      if (player) {
         await me.voice.setDeaf(deaf).catch(() => null);
         return { success: true };
      }
    }
    return { success: false, message: 'Bot voice player not found.' };
  } catch (err) {
    console.error('Failed to toggle deafen:', err);
    return { success: false, message: 'An error occurred while updating voice state.' };
  }
}

let vcStatusIndex = 0;
let emojiIndex = 0;

/**
 * Dynamically updates the bot's Voice Channel Status with server statistics
 * and aesthetic emojis as requested by the user, rotating sequentially.
 */
export async function updateBotVcStatus(channel) {
  if (!channel || !channel.isVoiceBased()) return;
  
  const config = db.getGuildConfig(channel.guild.id);
  if (config.vcStatusEnabled === false) {
    try {
      await channel.client.rest.put(`/channels/${channel.id}/voice-status`, { body: { status: null } });
    } catch (e) {}
    return;
  }
  
  const emojis = [
    '<a:a_fheartSpinWhite:1516523707181433109>',
    '<:00XO:1516521724689256550>',
    '<a:emoji_114:1516523064492425318>',
    '<a:81509ripyourheartout:1516523054283493576>',
    '<a:thunder:1533844816557768764>',
    '<a:🦇:1451690277126275267>',
    '<a:nt:1445649701809684552>',
    '<a:MMMilkDance:1538515109146660956>'
  ];
  
  const startEmoji = emojis[emojiIndex % emojis.length];
  const endEmoji = emojis[(emojiIndex + 1) % emojis.length];
  emojiIndex++;

  const guild = channel.guild;
  const vcMembers = channel.members;
  
  const connected = vcMembers.size;
  const muted = vcMembers.filter(m => m.voice.selfMute || m.voice.serverMute).size;
  const deafened = vcMembers.filter(m => m.voice.selfDeaf || m.voice.serverDeaf).size;
  
  const totalMembers = guild.memberCount;
  const totalBots = guild.members.cache.filter(m => m.user.bot).size;
  const activeMembers = guild.members.cache.filter(m => m.voice.channelId).size;

  const templates = [
    `${startEmoji} **Total Members : ${totalMembers}** ${endEmoji}`,
    `${startEmoji} **Active Members : ${activeMembers} !!**`,
    `${startEmoji} **Users Connected : ${connected}** ${endEmoji}`,
    `${startEmoji} **Users Muted : ${muted}** ${endEmoji}`,
    `${startEmoji} **Total Bots : ${totalBots}** ${endEmoji} **!!**`,
    `<a:PI_nezurun:1538517600013783060> **Members : ${totalMembers} . <a:AnyaYay:1537513785718476850> Voice Chat : ${connected}**`
  ];
  
  const finalStatus = templates[vcStatusIndex % templates.length];
  vcStatusIndex++;
  
  try {
    await channel.client.rest.put(
      `/channels/${channel.id}/voice-status`,
      { body: { status: finalStatus } }
    );
  } catch (error) {
    // Gracefully ignore rate limits or permission errors
  }
}

