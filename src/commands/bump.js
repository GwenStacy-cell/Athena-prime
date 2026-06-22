import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

export const commands = [
{
  name: 'bump',
  description: 'Configure the bump reminder role.',
  permissions: [PermissionFlagsBits.ManageGuild],

  // Slash Command Definition
  slashDef: new SlashCommandBuilder()
    .setName('bump')
    .setDescription('Configure the bump reminder system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('role')
      .setDescription('Set the role to be pinged for bump reminders')
      .addRoleOption(opt => opt
        .setName('role')
        .setDescription('The role to ping')
        .setRequired(true)
      )
    ),

  // Prefix Command Handler
  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply({ embeds: [embed.danger('Permission Denied', 'You need `ManageGuild` permissions to configure bump settings.')] });
    }

    const sub = args[0]?.toLowerCase();
    if (sub === 'role') {
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
      if (!role) {
        return message.reply({ embeds: [embed.warn('Invalid Usage', 'Please mention a role or provide a role ID. Example: `!bump role @BumpPing`')] });
      }

      const cfg = db.getGuildConfig(message.guild.id);
      cfg.bumpRoleId = role.id;
      db.updateGuildConfig(message.guild.id, cfg);

      return message.reply({ embeds: [embed.success('Bump Role Set', `The bump reminder will now ping ${role}.`)] });
    }

    return message.reply({ embeds: [embed.warn('Invalid Usage', 'Usage: `!bump role @role`')] });
  },

  // Slash Command Handler
  async executeSlash(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'role') {
      const role = interaction.options.getRole('role');
      const cfg = db.getGuildConfig(interaction.guild.id);
      cfg.bumpRoleId = role.id;
      db.updateGuildConfig(interaction.guild.id, cfg);

      return interaction.reply({ embeds: [embed.success('Bump Role Set', `The bump reminder will now ping ${role}.`)] });
    }
  }
}
];
