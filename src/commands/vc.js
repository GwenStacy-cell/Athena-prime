import { PermissionFlagsBits } from 'discord.js';
import embed from '../embed.js';
import { isAuthorized } from '../utils/helpers.js';

export const commands = [
  {
    name: 'vclock',
    description: 'Locks the current voice channel by denying Connect permission to @everyone.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) {
        return message.reply({ embeds: [embed.error('Unauthorized', 'You do not have permission to use this command.')] });
      }
      const vc = message.member.voice.channel;
      if (!vc) return message.reply({ embeds: [embed.error('Error', 'You must be in a voice channel to use this command.')] });
      
      try {
        await vc.permissionOverwrites.edit(message.guild.roles.everyone, {
          Connect: false
        });
        await message.reply({ embeds: [embed.success('VC Locked', `**${vc.name}** has been locked.`)] });
      } catch (err) {
        await message.reply({ embeds: [embed.error('Error', 'Failed to lock the voice channel. Check my permissions.')] });
      }
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.error('Unauthorized', 'You do not have permission.')], ephemeral: true });
      }
      const vc = interaction.member?.voice?.channel;
      if (!vc) return interaction.reply({ embeds: [embed.error('Error', 'You must be in a voice channel.')], ephemeral: true });
      
      try {
        await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
        await interaction.reply({ embeds: [embed.success('VC Locked', `**${vc.name}** has been locked.`)] });
      } catch (err) {
        await interaction.reply({ embeds: [embed.error('Error', 'Failed to lock.')], ephemeral: true });
      }
    }
  },
  {
    name: 'vcunlock',
    description: 'Unlocks the current voice channel for @everyone.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return;
      const vc = message.member.voice.channel;
      if (!vc) return message.reply({ embeds: [embed.error('Error', 'You must be in a voice channel.')] });
      
      try {
        await vc.permissionOverwrites.edit(message.guild.roles.everyone, {
          Connect: null
        });
        await message.reply({ embeds: [embed.success('VC Unlocked', `**${vc.name}** has been unlocked.`)] });
      } catch (err) {
        await message.reply({ embeds: [embed.error('Error', 'Failed to unlock.')] });
      }
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) return;
      const vc = interaction.member?.voice?.channel;
      if (!vc) return interaction.reply({ embeds: [embed.error('Error', 'You must be in a voice channel.')], ephemeral: true });
      
      try {
        await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null });
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
      if (!(await isAuthorized(interaction.user, interaction.guild))) return;
      const vc = interaction.member?.voice?.channel;
      if (!vc) return interaction.reply({ embeds: [embed.error('Error', 'You must be in a voice channel.')], ephemeral: true });
      
      let count = 0;
      await interaction.deferReply();
      for (const [id, member] of vc.members) {
        if (member.voice.serverDeaf) {
          try {
            await member.voice.setDeaf(false);
            count++;
          } catch(e) {}
        }
      }
      await interaction.editReply({ embeds: [embed.success('Success', `Undeafened **${count}** members in **${vc.name}**.`)] });
    }
  }
];
