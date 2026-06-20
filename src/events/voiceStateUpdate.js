import { ChannelType, PermissionFlagsBits, AuditLogEvent } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import db from '../database.js';
import { connectToHomeVc, updateBotVcStatus } from '../utils/voice.js';
import { buildControlPanel, buildSharedPanel } from '../commands/jtc.js';
import statsDB from '../statsDB.js';
import { calculateLevel, getRandomXp, getRoleMultiplier, processLevelUp } from '../utils/xpEngine.js';
import { isBotOwnerSync } from '../utils/helpers.js';
import { handleWarn } from '../commands/moderation.js';

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState) {
    const client = newState.client;
    const guild = newState.guild || oldState.guild;
    const userId = newState.id;

    // Simple lock to prevent multiple shared panels from being created simultaneously
    if (!client.jtcPanelLocks) client.jtcPanelLocks = new Set();
    if (!client.vcSessions) client.vcSessions = new Map();

    // ==========================================
    // STATS TRACKER & VOICE XP
    // ==========================================
    if (!newState.member?.user.bot) {
      const oldChannelId = oldState.channelId;
      const newChannelId = newState.channelId;

      if (oldChannelId !== newChannelId) {

        // ==========================================
        // MOVE PROTECTION INTERCEPTOR
        // ==========================================
        if (oldChannelId && newChannelId) {
          if (db.isMoveProtected(guild.id, userId)) {
            // Give audit logs a moment to register
            setTimeout(async () => {
              const auditLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberMove }).catch(() => null);
              console.log(`[MoveProtection] Fetched audit logs for move. Found: ${auditLogs ? auditLogs.entries.size : 0} entries.`);
              
              if (auditLogs) {
                // Debug log the entries
                auditLogs.entries.forEach(e => console.log(`[MoveProtection] Audit Log Entry: Target ${e.target?.id}, Executor ${e.executor?.id}, Created ${e.createdTimestamp}, Now ${Date.now()}`));

                const moveLog = auditLogs.entries.find(e => e.target?.id === userId && Math.abs(Date.now() - e.createdTimestamp) < 15000);
                if (moveLog) {
                  const executor = moveLog.executor;
                  if (executor.id !== client.user.id && executor.id !== userId) {
                    // Check if executor is Bot Owner or Server Owner (Bypass allowed)
                    if (executor.id === guild.ownerId || isBotOwnerSync(executor.id)) {
                      console.log(`[MoveProtection] Bypass triggered for ${executor.tag} (Owner/BotOwner)`);
                      return; // Bypass move protection
                    }

                    console.log(`[MoveProtection] Intercepted illegal move of ${userId} by ${executor.id}. Reverting...`);
                    
                    // Restitution: Move target back to previous channel
                    await newState.member.voice.setChannel(oldChannelId).catch(() => null);

                    // Punish executor: Issue a warning
                    const execMember = await guild.members.fetch(executor.id).catch(() => null);
                    if (execMember) {
                      await handleWarn(guild, guild.members.me, execMember, `Automated: Illegally moving protected user <@${userId}>`);
                    }
                  }
                }
              }
            }, 3000);
          }
        }
        // User left or switched channels
        if (oldChannelId) {
          const session = client.vcSessions.get(userId);
          if (session && session.channelId === oldChannelId) {
            const seconds = Math.floor((Date.now() - session.joinTime) / 1000);
            statsDB.logVoice(guild.id, userId, oldChannelId, seconds);
            
            // --- VOICE XP ---
            const xpSystem = db.getXpSystem(guild.id);
            if (xpSystem && xpSystem.enabled) {
              const minutes = Math.floor(seconds / 60);
              if (minutes > 0) {
                const userXp = db.getUserXp(guild.id, userId);
                const mult = getRoleMultiplier(guild.id, oldState.member || newState.member);
                
                // Award XP equivalent to typing a message every 2 minutes
                // Example: 1 minute = (getRandomXp() / 2) * mult
                const totalXpGained = Math.floor(minutes * (getRandomXp() / 1.5) * mult);
                
                userXp.xp += totalXpGained;
                const newLevel = calculateLevel(userXp.xp);
                if (newLevel > userXp.level) {
                  userXp.level = newLevel;
                  processLevelUp(client, guild, oldState.member || newState.member, newLevel).catch(() => null);
                }
                db.setUserXp(guild.id, userId, userXp);
              }
            }
          }
          client.vcSessions.delete(userId);
        }
        
        // User joined or switched to a new channel
        if (newChannelId) {
          client.vcSessions.set(userId, {
            channelId: newChannelId,
            joinTime: Date.now()
          });
        }
      }
    }

    // ==========================================
    // BOT HOME VC RESTORE (Instant Reconnect)
    // ==========================================
    if (userId === client.user.id) {
      const config = db.getGuildConfig(guild.id);
      const homeVcId = config.homeVcId;
      if (!homeVcId) return;

      if (newState.channelId !== homeVcId) {
        console.log(`[JTC] Bot voice state changed in ${guild.name}. Force restoring home VC...`);
        
        // Only destroy the connection if the bot was fully disconnected.
        // If it was just dragged to another VC, smoothly move it back without disconnecting.
        if (!newState.channelId) {
          const connection = getVoiceConnection(guild.id);
          if (connection) connection.destroy();
        }

        // Reconnect immediately
        connectToHomeVc(guild, homeVcId);
      }
      return;
    }

    // ==========================================
    // BOT HOME VC DYNAMIC STATUS SYNC
    // ==========================================
    const config = db.getGuildConfig(guild.id);
    const homeVcId = config.homeVcId;
    if (homeVcId) {
      const homeChannel = guild.channels.cache.get(homeVcId);
      if (homeChannel) {
        updateBotVcStatus(homeChannel);
      }
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
                  const sharedPanel = buildSharedPanel(newState.guild.id);
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
          let attempt = 0;
          const sendPanel = async () => {
            try {
              const freshChannel = await guild.channels.fetch(tempChannel.id).catch(() => null);
              if (!freshChannel) { console.warn('[JTC] VC channel gone before panel send'); return; }
              await freshChannel.send(vcPanel);
              console.log(`[JTC] ✅ Sent panel to VC text: ${freshChannel.name}`);
            } catch (e) {
              attempt++;
              if (attempt < 3) {
                console.warn(`[JTC] ⚠️ VC text send failed (attempt ${attempt}): ${e.message}, retrying in 2s...`);
                setTimeout(sendPanel, 2000);
              } else {
                console.error(`[JTC] ❌ VC text send failed after 3 attempts: ${e.message}`);
              }
            }
          };
          sendPanel();
        }, 3000); // 3 second initial delay

      } catch (err) {
        console.error('[JTC] Failed to create temp channel:', err);
      }
    }


    // ==========================================
    // JOIN TO CREATE — USER LEFT A CHANNEL
    // ==========================================
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      if (db.isJtcChannel(oldState.channelId)) {
        let leftChannel = guild.channels.cache.get(oldState.channelId);
        if (!leftChannel) {
          leftChannel = await guild.channels.fetch(oldState.channelId).catch(() => null);
        }

        if (leftChannel) {
          // Count real members in the channel (filter out bots, or just count all)
          const membersCount = leftChannel.members.size;
          
          if (membersCount === 0) {
            const jtcRecord = db.getJtcChannel(leftChannel.id);
            
            // Look for a linked text channel
            let textChannel = null;
            if (jtcRecord?.textChannelId) {
              textChannel = guild.channels.cache.get(jtcRecord.textChannelId) || await guild.channels.fetch(jtcRecord.textChannelId).catch(() => null);
            }
            
            // Fallback for older "zombie" text channels created before the patch:
            if (!textChannel && jtcRecord) {
               textChannel = guild.channels.cache.find(c => 
                 c.type === 0 && // GuildText
                 c.parentId === leftChannel.parentId &&
                 c.name.endsWith('-text') &&
                 c.permissionOverwrites.cache.get(jtcRecord.ownerId)?.allow.has('ManageChannels')
               );
            }

            db.removeJtcChannel(leftChannel.id);
            if (textChannel) {
              await textChannel.delete('JTC: Auto-cleanup of linked text channel').catch(() => null);
              console.log(`[JTC] 🗑️ Deleted linked text room: ${textChannel.name}`);
            }
            await leftChannel.delete('JTC: All members left, auto-cleanup').catch(() => null);
            console.log(`[JTC] 🗑️ Deleted empty room: ${leftChannel.name}`);
          }
        }
      }
    }
  }
};
