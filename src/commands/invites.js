import { PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

export const commands = [
  {
    name: 'invitesetup',
    description: 'Setup the invite tracking channel for the server',
    permissions: [PermissionFlagsBits.Administrator],
    aliases: ['setinvites', 'invitetracker'],
    executePrefix: async (message) => {
      await setupInviteTracker(message.guild, message.channel, message.member);
    },
    executeSlash: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      await setupInviteTracker(interaction.guild, interaction.channel, interaction.member, interaction);
    }
  }
];

async function setupInviteTracker(guild, replyChannel, member, interaction = null) {
  const reply = async (msg) => {
    if (interaction) await interaction.editReply(msg);
    else await replyChannel.send(msg);
  };

  try {
    let inviteChannel = guild.channels.cache.find(c => c.name === 'invite-logs' && c.type === ChannelType.GuildText);
    
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

    db.updateGuildConfig(guild.id, { inviteChannelId: inviteChannel.id });

    await reply({
      embeds: [
        embed.success(
          'Invite Tracker Setup Complete',
          `Invite tracking has been enabled!\n\n<a:Animated_Arrow_Red:1462005582826311712> **Logs Channel:** ${inviteChannel}\n<a:Animated_Arrow_Red:1462005582826311712> **Status:** Active & Listening\n\nThe bot will now carefully monitor every join and detect exactly who invited them, posting an aesthetic log in the designated channel.`
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
