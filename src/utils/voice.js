import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice';

/**
 * Connect the bot to its designated Home VC in a guild
 */
export function connectToHomeVc(guild, channelId) {
  if (!guild || !channelId) return null;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) {
    console.error(`[Medusa Prime] Home Voice Channel ${channelId} not found in guild ${guild.name}`);
    return null;
  }

  try {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: true // Quiet, professional deafen
    });

    console.log(`[Medusa Prime] Joined Home VC "${channel.name}" in guild "${guild.name}"`);
    return connection;
  } catch (error) {
    console.error(`[Medusa Prime] Failed to join Home VC in guild ${guild.name}:`, error);
    return null;
  }
}
