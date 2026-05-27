import { getVoiceConnection } from '@discordjs/voice';
import db from '../database.js';
import { connectToHomeVc } from '../utils/voice.js';

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState) {
    const client = newState.client;
    // Check if the change is for the bot itself
    if (newState.id !== client.user.id) return;

    const guild = newState.guild;
    const config = db.getGuildConfig(guild.id);
    const homeVcId = config.homeVcId;

    if (!homeVcId) return;

    // If bot was moved or disconnected from home VC
    if (newState.channelId !== homeVcId) {
      console.log(`[Medusa Prime] Bot voice state changed in guild ${guild.name} (${guild.id}). Restoring connection to home VC: ${homeVcId}`);
      
      // Delay slightly to allow voice connection states to clean up properly
      setTimeout(() => {
        const connection = getVoiceConnection(guild.id);
        if (!connection || connection.joinConfig.channelId !== homeVcId) {
          connectToHomeVc(guild, homeVcId);
        }
      }, 1500);
    }
  }
};
