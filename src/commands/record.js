import { ChannelType, PermissionFlagsBits, MessageFlags } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';

const BLANK_IMAGE = 'https://i.imgur.com/1a0tQ5a.png';

export const commands = [
  {
    name: 'record',
    slashHidden: true,
    description: 'Setup the voice logging channel or start a fake recording',
    aliases: ['voicelog', 'vclogs', 'setuplogs'],
    async executePrefix(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.channel.send(cv2.error('Permission Denied', 'You need Administrator permissions to use this command.'));
      }

      const sub = args[0] ? args[0].toLowerCase() : '';

      if (sub === 'start') {
        const vc = message.member.voice.channel;
        if (!vc) return message.reply(cv2.error('Voice Recording Failed', 'You must be in a Voice Channel to start a recording session.'));
        
        const container = {
          type: 17,
          components: [
            {
              type: 9,
              components: [
                { type: 10, content: `## **Voice Recording Started**\n\n-# Channel: ?? **${vc.name}** | Initiated By: ${message.author}\n\n-# Live multi-user audio capture is active (Unmuted & Undeafened).\n-# When finished, run \`!record stop\` or click **Stop & Export** below.\n-# Audio recording will be delivered directly via DM (or in this channel).` }
              ],
              accessory: { type: 11, media: { url: BLANK_IMAGE } }
            },
            {
              type: 1,
              components: [
                { type: 2, custom_id: 'record_stop', label: 'Stop & Export', style: 2 },
                { type: 2, custom_id: 'record_status', label: 'Check Status', style: 2 }
              ]
            },
            { type: 14, divider: true },
            { type: 10, content: '-# Secure Unbypassable Voice Security' }
          ]
        };
        return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (sub === 'stop') {
        const vc = message.member.voice.channel;
        const vcName = vc ? vc.name : 'Unknown Channel';
        const container = {
          type: 17,
          components: [
            {
              type: 9,
              components: [
                { type: 10, content: `## **Voice Recording Stopped**\n\n-# Channel: ?? **${vcName}**\n\n-# No speech or audio activity was detected during this recording session.` }
              ],
              accessory: { type: 11, media: { url: BLANK_IMAGE } }
            },
            { type: 14, divider: true },
            { type: 10, content: '-# Secure Unbypassable Voice Security' }
          ]
        };
        return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
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

