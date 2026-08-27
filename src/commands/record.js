import { ChannelType, PermissionFlagsBits, MessageFlags } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { startRecording, stopRecording } from '../utils/audioRecorder.js';

export const commands = [
  {
    name: 'record',
    slashHidden: true,
    description: 'Setup the voice logging channel or start a real voice recording',
    aliases: ['voicelog', 'vclogs', 'setuplogs'],
    async executePrefix(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.channel.send(cv2.error('Permission Denied', 'You need Administrator permissions to use this command.'));
      }

      const sub = args[0] ? args[0].toLowerCase() : '';

      if (sub === 'start') {
        let vc = message.member.voice.channel;
        const target = args[1];
        if (target) {
            // Check if it's a channel
            const channel = message.guild.channels.cache.get(target.replace(/<#|>/g, ''));
            if (channel && channel.isVoiceBased()) {
                vc = channel;
            } else {
                // Check if it's a user
                const member = message.guild.members.cache.get(target.replace(/<@!|@|>/g, ''));
                if (member && member.voice.channel) {
                    vc = member.voice.channel;
                }
            }
        }
        
        if (!vc) return message.reply(cv2.error('Voice Recording Failed', 'You must be in a Voice Channel to start a recording session, or provide a valid Channel ID / User ID as a target.'));
        
        try {
          await startRecording(vc);
          const container = {
            type: 17,
            components: [
              { type: 10, content: `## **Voice Recording Started**\n\n-# Channel: ?? **${vc.name}** | Initiated By: ${message.author}\n\n-# Live multi-user audio capture is active (Unmuted & Undeafened).\n-# When finished, run \`!record stop\` or click **Stop & Export** below.\n-# Audio recording will be delivered directly via DM (or in this channel).` },
              {
                type: 1,
                components: [
                  { type: 2, custom_id: 'record_stop', label: 'Stop & Export', style: 2 },
                  { type: 2, custom_id: 'record_status', label: 'Check Status', style: 2 }
                ]
              },
              { type: 14, divider: true },
              { type: 10, content: '-# Athena Bulletproof Security' }
            ]
          };
          return message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
          return message.reply(cv2.error('Recording Failed', err.message));
        }
      }

      if (sub === 'stop') {
        const vc = message.member.voice.channel;
        const vcName = vc ? vc.name : 'Unknown Channel';
        
        const container = {
          type: 17,
          components: [
            { type: 10, content: `## **Voice Recording Stopped**\n\n-# Channel: ?? **${vcName}**\n\n-# Processing and exporting the audio file, please wait...` },
            { type: 14, divider: true },
            { type: 10, content: '-# Athena Bulletproof Security' }
          ]
        };
        const msg = await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        
        try {
          const result = await stopRecording(message.guild.id);
          if (!result) {
             return msg.edit({ components: [{ type: 17, components: [{ type: 10, content: '-# No active recording found for this server.' }] }] });
          }
          const { mp3Path, startTime, durationMs } = result;
          
          const durSec = Math.floor(durationMs / 1000);
          const durationStr = `${Math.floor(durSec/60)}m ${durSec%60}s`;
          const startDate = new Date(startTime).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
          
          const dmContainer = {
             type: 17,
             components: [
                { type: 10, content: `## **Athena Voice Export**` },
                {
                   type: 9,
                   components: [{ type: 10, content: `-# **Server :** **${message.guild.name}**\n-# **Channel :** **${vcName}**\n-# **Started At :** **${startDate}**\n-# **Duration :** **${durationStr}**` }],
                   accessory: { type: 11, media: { url: message.guild.iconURL({ dynamic: true }) || 'https://i.imgur.com/8Qj85vP.png' } }
                },
                { type: 14, divider: true },
                { type: 10, content: `-# **Audio file is attached below.**` }
             ]
          };
          
          await message.author.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2, files: [mp3Path] }).catch(() => null);
          await msg.edit({ components: [{ type: 17, components: [{ type: 10, content: `-# **Audio Export Successful:** Delivered securely to your DMs.` }] }] });
          
          const fs = await import('fs');
          fs.unlink(mp3Path, () => {});
        } catch (err) {
          await msg.edit({ components: [{ type: 17, components: [{ type: 10, content: `-# **Failed to process audio:** ${err.message}` }] }] });
        }
        return;
      }

      // Default behavior: Setup Voice Logs
      try {
        let channel = message.guild.channels.cache.find(c => c.name === 'voice-records' && c.type === ChannelType.GuildText);
        if (!channel) {
          channel = await message.guild.channels.create({
            name: 'voice-records',
            type: ChannelType.GuildText,
            topic: 'Automated Voice Join/Leave Records',
            permissionOverwrites: [
              {
                id: message.guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
              }
            ]
          });
        }
        db.updateGuildConfig(message.guild.id, { voiceLogChannel: channel.id });
        message.channel.send(cv2.success('Voice Records Setup', `Successfully setup voice logging in <#${channel.id}>.\nAll VC joins and leaves will be recorded there.`));
      } catch (error) {
        console.error(error);
        message.channel.send(cv2.error('Setup Failed', 'Failed to create the voice records channel. Check my permissions.'));
      }
    }
  }
];
