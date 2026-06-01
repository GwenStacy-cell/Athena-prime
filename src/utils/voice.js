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
 * Toggle the bot's OWN self-deafen by leaving and rejoining the VC.
 * @discordjs/voice manages all op-4 packets internally, so the only
 * 100% reliable approach is to destroy the old connection and create a new
 * one with the desired selfDeaf value.
 */
export async function toggleBotDeafen(guild, deaf) {
  try {
    const me = guild.members.me;
    if (!me || !me.voice?.channelId) {
      return { success: false, message: 'The bot is not currently in a voice channel.' };
    }

    const channelId = me.voice.channelId;

    // Destroy existing connection (if any) so we can cleanly rejoin
    const { getVoiceConnection } = await import('@discordjs/voice');
    const existing = getVoiceConnection(guild.id);
    if (existing) existing.destroy();

    // Rejoin with the new selfDeaf setting
    const { joinVoiceChannel } = await import('@discordjs/voice');
    joinVoiceChannel({
      channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: deaf
    });

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
