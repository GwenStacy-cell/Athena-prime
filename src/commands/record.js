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
        const vc = message.member.voice.channel;
        if (!vc) return message.reply(cv2.error('Voice Recording Failed', 'You must be in a Voice Channel to start a recording session.'));
        
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
          const mp3Path = await stopRecording(message.guild.id);
          if (!mp3Path) {
             return msg.edit({ content: 'No active recording found for this server.' });
          }
          await msg.edit({ content: `-# **Audio Export Successful:**`, files: [mp3Path] });
        } catch (err) {
          await msg.edit({ content: `-# **Failed to process audio:** ${err.message}` });
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
