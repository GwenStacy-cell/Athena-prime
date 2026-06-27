import { PermissionFlagsBits } from 'discord.js';
import embed from '../embed.js';
import { isAuthorized } from '../utils/helpers.js';

export const commands = [
  {
    name: 'vclock',
    description: 'Locks a voice channel by denying Connect and text permissions to @everyone.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    options: [
      {
        name: 'channel',
        description: 'The voice channel to lock (defaults to your current VC)',
        type: 7,
        required: false
      }
    ],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) {
        return message.reply({ embeds: [embed.error('Unauthorized', 'You do not have permission to use this command.')] });
      }
      
      const args = message.content.trim().split(/ +/).slice(1);
      let vc = message.member.voice.channel;
      
      if (args[0]) {
        const parsedId = args[0].replace(/<#|>/g, '');
        const targetChannel = message.guild.channels.cache.get(parsedId);
        if (targetChannel && targetChannel.isVoiceBased()) {
          vc = targetChannel;
        } else {
          return message.reply({ embeds: [embed.error('Error', 'Invalid voice channel provided.')] });
        }
      }
      
      if (!vc) return message.reply({ embeds: [embed.error('Error', 'You must be in a voice channel or provide a valid voice channel ID.')] });
      
      try {
        await vc.permissionOverwrites.edit(message.guild.roles.everyone, {
          Connect: false,
          SendMessages: false,
          ReadMessageHistory: false
        });
        await message.reply({ embeds: [embed.success('VC Locked', `**${vc.name}** has been locked.`)] });
      } catch (err) {
        await message.reply({ embeds: [embed.error('Error', 'Failed to lock the voice channel. Check my permissions.')] });
      }
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.error('Unauthorized', 'You do not have permission.')], ephemeral: true }).catch(() => null);
      }
      
      const targetChannel = interaction.options.getChannel('channel');
      const vc = targetChannel && targetChannel.isVoiceBased() ? targetChannel : interaction.member?.voice?.channel;
      
      if (!vc) return interaction.reply({ embeds: [embed.error('Error', 'You must be in a voice channel or select one.')], ephemeral: true });
      
      try {
        await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          Connect: false,
          SendMessages: false,
          ReadMessageHistory: false
        });
        await interaction.reply({ embeds: [embed.success('VC Locked', `**${vc.name}** has been locked.`)] });
      } catch (err) {
        await interaction.reply({ embeds: [embed.error('Error', 'Failed to lock.')], ephemeral: true });
      }
    }
  },
  {
    name: 'vcunlock',
    description: 'Unlocks a voice channel for @everyone.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    options: [
      {
        name: 'channel',
        description: 'The voice channel to unlock (defaults to your current VC)',
        type: 7,
        required: false
      }
    ],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return;
      
      const args = message.content.trim().split(/ +/).slice(1);
      let vc = message.member.voice.channel;
      
      if (args[0]) {
        const parsedId = args[0].replace(/<#|>/g, '');
        const targetChannel = message.guild.channels.cache.get(parsedId);
        if (targetChannel && targetChannel.isVoiceBased()) {
          vc = targetChannel;
        } else {
          return message.reply({ embeds: [embed.error('Error', 'Invalid voice channel provided.')] });
        }
      }
      
      if (!vc) return message.reply({ embeds: [embed.error('Error', 'You must be in a voice channel or provide a valid voice channel ID.')] });
      
      try {
        await vc.permissionOverwrites.edit(message.guild.roles.everyone, {
          Connect: null,
          SendMessages: null,
          ReadMessageHistory: null
        });
        await message.reply({ embeds: [embed.success('VC Unlocked', `**${vc.name}** has been unlocked.`)] });
      } catch (err) {
        await message.reply({ embeds: [embed.error('Error', 'Failed to unlock.')] });
      }
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.error('Unauthorized', 'You do not have permission.')], ephemeral: true }).catch(() => null);
      }
      
      const targetChannel = interaction.options.getChannel('channel');
      const vc = targetChannel && targetChannel.isVoiceBased() ? targetChannel : interaction.member?.voice?.channel;
      
      if (!vc) return interaction.reply({ embeds: [embed.error('Error', 'You must be in a voice channel or select one.')], ephemeral: true });
      
      try {
        await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          Connect: null,
          SendMessages: null,
          ReadMessageHistory: null
        });
        await interaction.reply({ embeds: [embed.success('VC Unlocked', `**${vc.name}** has been unlocked.`)] });
      } catch (err) {
        await interaction.reply({ embeds: [embed.error('Error', 'Failed to unlock.')], ephemeral: true });
      }
    }
  },
  {
    name: 'undeafenall',
    description: 'Undeafens all members in your current voice channel.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.DeafenMembers],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return;
      const vc = message.member.voice.channel;
      if (!vc) return message.reply({ embeds: [embed.error('Error', 'You must be in a voice channel.')] });
      
      let count = 0;
      for (const [id, member] of vc.members) {
        if (member.voice.serverDeaf) {
          try {
            await member.voice.setDeaf(false);
            count++;
          } catch(e) {}
        }
      }
      await message.reply({ embeds: [embed.success('Success', `Undeafened **${count}** members in **${vc.name}**.`)] });
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.error('Unauthorized', 'You do not have permission.')], ephemeral: true }).catch(() => null);
      }
      const vc = interaction.member?.voice?.channel;
      if (!vc) return interaction.reply({ embeds: [embed.error('Error', 'You must be in a voice channel.')], ephemeral: true });
      
      await interaction.deferReply({ ephemeral: false });
      await interaction.editReply({ embeds: [embed.info('Undeafen All', 'Initiating mass undeafen...')] }).catch(() => null);

      let count = 0;
      const promises = [];
      vc.members.forEach(member => {
        if (member.voice.serverDeaf) {
          promises.push(
            member.voice.setDeaf(false)
              .then(() => {
                count++;
                if (count % 15 === 0) {
                  interaction.editReply({ embeds: [embed.info('Undeafen All', `Undeafening in progress...\n\n Undeafened: **${count}**`)] }).catch(() => null);
                }
              })
              .catch(() => null)
          );
        }
      });
      
      await Promise.all(promises);
      await interaction.editReply({ embeds: [embed.success('Success', `Undeafened **${count}** members in **${vc.name}**.`)] }).catch(() => null);
    }
  }
];
