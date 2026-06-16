import { joinVoiceChannel } from '@discordjs/voice';

/**
 * Connect the bot to its designated Home VC in a guild
 */
export function connectToHomeVc(guild, channelId) {
  if (!guild || !channelId) return null;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) {
    console.error(`[Athena Prime] Home Voice Channel ${channelId} not found in guild ${guild.name}`);
    return null;
  }

  try {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false
    });
    console.log(`[Athena Prime] Joined Home VC "${channel.name}" in guild "${guild.name}"`);
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

    const channelId = me.voice.channelId;

    // Update connection with the new selfDeaf setting without destroying it
    const { joinVoiceChannel } = await import('@discordjs/voice');
    joinVoiceChannel({
      channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: deaf
    });

    return { success: true };
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
  
  const emojis = [
    '<a:a_fheartSpinWhite:1516523707181433109>',
    '<:00XO:1516521724689256550>',
    '<a:emoji_114:1516523064492425318>',
    '<a:81509ripyourheartout:1516523054283493576>',
    '<a:thunder:1516523058742169674>',
    '<a:bat1:1516523055642579016>',
    '<a:nt:1445649701809684552>',
    '<a:emoji_110:1513755776928321586>'
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
    `${startEmoji} Total Members : ${totalMembers} ${endEmoji}`,
    `${startEmoji} Active Members : ${activeMembers} !!`,
    `${startEmoji} Users Connected : ${connected} ${endEmoji}`,
    `${startEmoji} Users Muted : ${muted} ${endEmoji}`,
    `${startEmoji} Total Bots : ${totalBots} ${endEmoji} !!`
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

