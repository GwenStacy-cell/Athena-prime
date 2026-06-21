import { PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

export const commands = [
  {
    name: 'invitesetup',
    description: 'Setup the invite tracking channel for the server',
    permissions: [PermissionFlagsBits.Administrator],
    aliases: ['setinvites', 'invitetracker'],
    options: [
      {
        name: 'channel',
        description: 'The channel to send invite logs to (leave blank to auto-create)',
        type: 7, // Channel
        channel_types: [ChannelType.GuildText],
        required: false
      }
    ],
    executePrefix: async (message, args) => {
      let targetChannel = null;
      if (args[0]) {
        targetChannel = message.guild.channels.cache.get(args[0].replace(/[<#>]/g, ''));
      }
      await setupInviteTracker(message.guild, message.channel, message.member, null, targetChannel);
    },
    executeSlash: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const targetChannel = interaction.options.getChannel('channel');
      await setupInviteTracker(interaction.guild, interaction.channel, interaction.member, interaction, targetChannel);
    }
  },
  {
    name: 'invitedisable',
    description: 'Disable invite tracking for the server',
    permissions: [PermissionFlagsBits.Administrator],
    aliases: ['disableinvites', 'inviteoff'],
    executePrefix: async (message) => {
      db.updateGuildConfig(message.guild.id, { inviteChannelId: null });
      return message.reply({ embeds: [embed.success('Invite Tracker Disabled', 'Invite tracking has been turned off.')] });
    },
    executeSlash: async (interaction) => {
      db.updateGuildConfig(interaction.guild.id, { inviteChannelId: null });
      return interaction.reply({ embeds: [embed.success('Invite Tracker Disabled', 'Invite tracking has been turned off.')], ephemeral: true });
    }
  }
];

async function setupInviteTracker(guild, replyChannel, member, interaction = null, targetChannel = null) {
  const reply = async (msg) => {
    if (interaction) await interaction.editReply(msg);
    else await replyChannel.send(msg);
  };

  try {
    let inviteChannel = targetChannel;
    
    if (!inviteChannel || inviteChannel.type !== ChannelType.GuildText) {
      inviteChannel = guild.channels.cache.find(c => c.name === 'invite-logs' && c.type === ChannelType.GuildText);
      if (!inviteChannel) {
        inviteChannel = await guild.channels.create({
          name: 'invite-logs',
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.SendMessages],
              allow: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: guild.client.user.id,
              allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.EmbedLinks]
            }
          ],
          reason: 'Setup Invite Tracking'
        });
      }
    }

    db.updateGuildConfig(guild.id, { inviteChannelId: inviteChannel.id });

    await reply({
      embeds: [
        embed.success(
          'Invite Tracker Setup Complete',
          `Invite tracking has been enabled!\n\n<a:61589pinkglock:1451707353450676265> **Logs Channel:** ${inviteChannel}\n<a:61589pinkglock:1451707353450676265> **Status:** Active & Listening\n\nThe bot will now carefully monitor every join and detect exactly who invited them, posting an aesthetic log in the designated channel.`
        )
      ]
    });
  } catch (err) {
    console.error('Error setting up invite tracker:', err);
    await reply({
      embeds: [embed.danger('Setup Failed', 'I lack permissions to create the channel or modify server settings.')]
    });
  }
}
