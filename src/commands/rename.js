import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import cv2 from '../cv2.js';
import { canModerate, isExtraOwner, isBotOwnerSync } from '../utils/helpers.js';

export const commands = [
  {
    name: 'ur',
    aliases: ['rename'],
    description: 'Renames a user in the server.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageNicknames],
    options: [
      { name: 'user', description: 'The member to rename', type: 6, required: true },
      { name: 'newname', description: 'The new nickname', type: 3, required: true }
    ],
    async executePrefix(message, args) {
      if (!args.length) {
        return message.reply(cv2.warn('Usage', `**Usage:** \`ur @user new_name\``));
      }

      const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
      if (!target) return message.reply(cv2.warn('Error', 'Please mention a valid member to rename.'));

      const newName = args.slice(1).join(' ');
      if (!newName) return message.reply(cv2.warn('Error', 'Please provide a new nickname.'));

      // Permission hierarchy check
      if (!isExtraOwner(message.author.id) && !isBotOwnerSync(message.author.id)) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
          return message.reply(cv2.error('Missing Permissions', 'You need the `Manage Nicknames` permission.'));
        }
        if (!canModerate(message.member, target)) {
          return message.reply(cv2.error('Hierarchy Error', 'You cannot rename someone with a higher or equal role.'));
        }
      }

      try {
        await target.setNickname(newName);
        
        const cfg = (await import('../database.js')).default.getGuildConfig(message.guild?.id || '0');
        const accentInt = cfg.accentColor ? parseInt(cfg.accentColor.replace('#', ''), 16) : 0x2b2d31;

        const successEmbed = new EmbedBuilder()
          .setColor(accentInt)
          .setDescription(`<a:AnyaYay:1537513785718476850> ${message.author} **Has Renamed** ${target} **|\n${newName}**`);

        await message.reply({ embeds: [successEmbed] });
      } catch (err) {
        message.reply(cv2.error('Error', `Failed to rename ${target}: \`${err.message}\``));
      }
    },
    async executeSlash(interaction) {
      const target = interaction.options.getMember('user');
      const newName = interaction.options.getString('newname');

      if (!isExtraOwner(interaction.user.id) && !isBotOwnerSync(interaction.user.id)) {
        if (!canModerate(interaction.member, target)) {
          return interaction.reply(cv2.error('Hierarchy Error', 'You cannot rename someone with a higher or equal role.'));
        }
      }

      try {
        await target.setNickname(newName);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#c6ff00')
          .setDescription(`<:emoji_16:1521464002046328944> ${interaction.user} **Has Renamed** ${target} **|\n${newName}**`)
          .setFooter({ text: 'Athena Prime Unbypassable Security' });

        await interaction.reply({ embeds: [successEmbed] });
      } catch (err) {
        interaction.reply(cv2.error('Error', `Failed to rename ${target}: \`${err.message}\``));
      }
    }
  }
];
