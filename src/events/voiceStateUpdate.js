import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import db from '../database.js';
import { connectToHomeVc } from '../utils/voice.js';
import { buildControlPanel } from '../commands/jtc.js';

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState) {
    const client = newState.client;
    const guild = newState.guild || oldState.guild;
    const userId = newState.id;

    // ==========================================
    // BOT HOME VC RESTORE
    // ==========================================
    if (userId === client.user.id) {
      const config = db.getGuildConfig(guild.id);
      const homeVcId = config.homeVcId;
      if (!homeVcId) return;

      if (newState.channelId !== homeVcId) {
        console.log(`[JTC] Bot voice state changed in ${guild.name}. Restoring home VC...`);
        setTimeout(() => {
          const connection = getVoiceConnection(guild.id);
          if (!connection || connection.joinConfig.channelId !== homeVcId) {
            connectToHomeVc(guild, homeVcId);
          }
        }, 1500);
      }
      return;
    }

    // ==========================================
    // JOIN TO CREATE — USER JOINED A CHANNEL
    // ==========================================
    const jtcConfig = db.getJtcConfig(guild.id);

    if (jtcConfig && newState.channelId === jtcConfig.lobbyChannelId) {
      // User joined the JTC lobby — create their personal channel
      const member = newState.member;
      if (!member) return;

      try {
        // Create the temp voice channel in the same category
        const tempChannel = await guild.channels.create({
          name: `${member.displayName}'s Room`,
          type: ChannelType.GuildVoice,
          parent: jtcConfig.categoryId || null,
          permissionOverwrites: [
            {
              id: guild.roles.everyone,
              allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel]
            },
            {
              id: member.id,
              allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers]
            },
            {
              id: client.user.id,
              allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ViewChannel]
            }
          ],
          reason: `JTC: Created by ${member.user.tag}`
        });

        // Move the member into their new channel
        await member.voice.setChannel(tempChannel).catch(() => null);

        // Register in database
        db.addJtcChannel(tempChannel.id, member.id, guild.id);

        // Send control panel to the VC text chat (Discord adds text chat to VCs)
        const panel = buildControlPanel(tempChannel, member);
        await tempChannel.send(panel).catch(() => null);

      } catch (err) {
        console.error('[JTC] Failed to create temp channel:', err);
      }
    }

    // ==========================================
    // JOIN TO CREATE — USER LEFT A CHANNEL
    // ==========================================
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const leftChannel = oldState.channel;
      if (!leftChannel) return;

      // Check if the left channel is a JTC temp channel
      if (db.isJtcChannel(leftChannel.id)) {
        // If channel is empty, delete it
        if (leftChannel.members.size === 0) {
          db.removeJtcChannel(leftChannel.id);
          await leftChannel.delete('JTC: All members left, auto-cleanup').catch(() => null);
        }
      }
    }
  }
};
