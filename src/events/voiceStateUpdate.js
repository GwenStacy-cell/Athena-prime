import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import db from '../database.js';
import { connectToHomeVc } from '../utils/voice.js';
import { buildControlPanel, buildSharedPanel } from '../commands/jtc.js';

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState) {
    const client = newState.client;
    const guild = newState.guild || oldState.guild;
    const userId = newState.id;

    // Simple lock to prevent multiple shared panels from being created simultaneously
    if (!client.jtcPanelLocks) client.jtcPanelLocks = new Set();

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
      const member = newState.member;
      if (!member) return;

      try {
        // Create the temp voice channel
        const tempChannel = await guild.channels.create({
          name: `${member.displayName}'s Room`,
          type: ChannelType.GuildVoice,
          parent: jtcConfig.categoryId || null,
          permissionOverwrites: [
            {
              id: guild.roles.everyone,
              allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            },
            {
              id: member.id,
              allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.SendMessages]
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.Connect, 
                PermissionFlagsBits.ManageChannels, 
                PermissionFlagsBits.MoveMembers, 
                PermissionFlagsBits.ViewChannel, 
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.UseApplicationCommands
              ]
            }
          ],
          reason: `JTC: Created by ${member.user.tag}`
        });

        // Move the member into their new channel
        await member.voice.setChannel(tempChannel).catch(() => null);

        // Register in database
        db.addJtcChannel(tempChannel.id, member.id, guild.id);

        const vcPanel = buildControlPanel(tempChannel, member);

        // ── Interface channel: ONE persistent panel, never duplicated ──
        const freshCfg = db.getJtcConfig(guild.id);
        if (freshCfg?.panelChannelId) {
          const panelCh = guild.channels.cache.get(freshCfg.panelChannelId);
          if (panelCh) {
            let existingMsg = null;
            if (freshCfg.panelMessageId) {
              existingMsg = await panelCh.messages.fetch(freshCfg.panelMessageId).catch(() => null);
            }
            if (!existingMsg && !client.jtcPanelLocks.has(guild.id)) {
              client.jtcPanelLocks.add(guild.id);
              try {
                // Fetch again to be absolutely sure no other process created it in the last few ms
                const freshCfgCheck = db.getJtcConfig(guild.id);
                const stillNoMsg = freshCfgCheck.panelMessageId ? await panelCh.messages.fetch(freshCfgCheck.panelMessageId).catch(() => null) : null;
                
                if (!stillNoMsg) {
                  const sharedPanel = buildSharedPanel();
                  const sentMsg = await panelCh.send(sharedPanel).catch(e => console.error('[JTC] Interface channel send failed:', e.message));
                  if (sentMsg) {
                    db.setPanelMessageId(guild.id, sentMsg.id);
                    console.log(`[JTC] ✅ Created persistent panel in #${panelCh.name}`);
                  }
                }
              } finally {
                setTimeout(() => client.jtcPanelLocks.delete(guild.id), 5000); // Release lock after 5s
              }
            } else if (existingMsg) {
              console.log(`[JTC] ✅ Reusing existing panel in #${panelCh.name}`);
            }
          }
        }

        // ── Send panel to VC text chat (delayed to let Discord init the channel) ──
        setTimeout(async () => {
          try {
            const freshChannel = guild.channels.cache.get(tempChannel.id);
            if (!freshChannel) { console.warn('[JTC] VC channel gone before panel send'); return; }
            await freshChannel.send(vcPanel);
            console.log(`[JTC] ✅ Sent panel to VC text: ${freshChannel.name}`);
          } catch (e) {
            console.error(`[JTC] ❌ VC text send failed: ${e.message}`);
          }
        }, 2000); // 2 second delay for Discord to fully init the VC text

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
