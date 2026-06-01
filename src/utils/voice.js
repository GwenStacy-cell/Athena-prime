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
      selfDeaf: true
    });
    console.log(`[Athena Prime] Joined Home VC "${channel.name}" in guild "${guild.name}"`);
    return connection;
  } catch (error) {
    console.error(`[Athena Prime] Failed to join Home VC in guild ${guild.name}:`, error);
    return null;
  }
}

/**
 * Toggle the bot's own server-deafen state in its current voice channel.
 * Only works if the bot is already in a voice channel.
 */
export async function toggleBotDeafen(guild, deaf) {
  try {
    const me = guild.members.me;
    if (!me || !me.voice?.channelId) {
      return { success: false, message: 'The bot is not currently in a voice channel.' };
    }
    await me.voice.setDeaf(deaf, 'Deafen toggle by owner');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
