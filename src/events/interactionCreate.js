import { PermissionFlagsBits } from 'discord.js';
import commandMap from '../commands/loader.js';
import embed, { setGuildContext } from '../embed.js';
import db from '../database.js';
import { getAntinukeConfigPanel } from '../commands/security.js';
import { handleEnukeButton, handleEnukeModal } from '../commands/enuke.js';
import { handleSpamModal, handleSpamMoreButton } from '../commands/spam.js';
import { isBotOwnerSync } from '../utils/helpers.js';
import { handleJtcSelectMenu, handleJtcModal } from '../commands/jtc.js';
import { handleWelcomeManagerButton, handleWelcomeManagerModal, handleWelcomeManagerMenu } from '../commands/welcome.js';
import { handleAccentButton, handleAccentModal } from '../commands/accent.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    // ==========================================
    // 1. CHAT INPUT SLASH COMMANDS
    // ==========================================
    if (interaction.isChatInputCommand()) {
      // Set guild accent context for all embed calls in this command
      if (interaction.guild) setGuildContext(interaction.guild.id);

      const cmd = commandMap.get(interaction.commandName);
      if (!cmd) {
        return interaction.reply({
          embeds: [embed.warn('Unknown Command', `${interaction.user} ❌ The command \`/${interaction.commandName}\` was not recognized.\n\nUse \`/help\` to see all available commands.`)],
          ephemeral: true
        });
      }

      // Verify permissions — bot owner AND extra owners bypass all checks in every server
      if (cmd.permissions && cmd.permissions.length > 0) {
        const isBypass = isBotOwnerSync(interaction.user.id) ||
          (interaction.guild && (
            interaction.user.id === interaction.guild.ownerId ||
            db.isExtraOwner(interaction.guild.id, interaction.user.id)
          ));

        if (!isBypass) {
          // interaction.member may be null in User App DM context — skip guild perm check
          const hasPerms = interaction.member
            ? cmd.permissions.every(perm => interaction.member.permissions.has(perm))
            : false;
          if (!hasPerms) {
            return interaction.reply({
              embeds: [embed.danger('Access Denied', `${interaction.user} 🛡️ You do not possess the required permissions to execute this command.\n\n**Required:** ${cmd.permissions.map(p => `\`${Object.entries(PermissionFlagsBits).find(([, v]) => v === p)?.[0] || 'Unknown'}\``).join(', ')}`)],
              ephemeral: true
            });
          }
        }
      }

      try {
        await cmd.executeSlash(interaction);
      } catch (error) {
        console.error(`Error executing command ${cmd.name} via Slash:`, error);
        const errEmbed = embed.danger(
          'Execution Error', 
          `${interaction.user} An unexpected error occurred while executing \`/${cmd.name}\`.\n\n**Tip:** Check that all required options are filled in correctly. Use \`/help\` for command usage.`
        );

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
        } else {
          await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
        }
      }
      return;
    }

    // ==========================================
    // 2. MODAL SUBMISSIONS
    // ==========================================
    if (interaction.isModalSubmit()) {
      // Enuke Manager modal
      if (interaction.customId.startsWith('enuke_modal_')) {
        try {
          await handleEnukeModal(interaction);
        } catch (error) {
          console.error('Error handling Enuke modal:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred during the nuke sequence.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      // Spam modal
      if (interaction.customId.startsWith('spam_modal_')) {
        try {
          await handleSpamModal(interaction);
        } catch (error) {
          console.error('Error handling Spam modal:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred with the spam command.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      // JTC modals
      if (interaction.customId.startsWith('jtc_') && interaction.customId.endsWith('_modal')) {
        try {
          await handleJtcModal(interaction);
        } catch (error) {
          console.error('Error handling JTC modal:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred with the voice channel action.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      // Welcome/Leave modals
      if (interaction.customId.startsWith('welc_modal_') || interaction.customId.startsWith('leav_modal_')) {
        try {
          await handleWelcomeManagerModal(interaction);
        } catch (error) {
          console.error('Error handling Welcome modal:', error);
        }
        return;
      }

      // Accent hex modal
      if (interaction.customId === 'accent_hex_modal') {
        try {
          await handleAccentModal(interaction);
        } catch (error) {
          console.error('Error handling Accent modal:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Failed to apply accent color.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }
    }

    // ==========================================
    // 3. INTERACTIVE COMPONENT BUTTON CLICKS
    // ==========================================
    if (interaction.isButton()) {
      // Set guild accent context for all embed calls in this button handler
      if (interaction.guild) setGuildContext(interaction.guild.id);
      // Enuke Manager button
      if (interaction.customId.startsWith('enuke_open_manager_')) {
        try {
          await handleEnukeButton(interaction);
        } catch (error) {
          console.error('Error handling Enuke button:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Failed to open Enuke Manager.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      // Verify Button
      if (interaction.customId === 'verify_button') {
        try {
          const verifyData = db.getVerification(interaction.guild.id);
          if (!verifyData || !verifyData.roleId) {
            return interaction.reply({ content: 'The verification system is currently disabled or improperly configured.', ephemeral: true });
          }
          const role = interaction.guild.roles.cache.get(verifyData.roleId);
          if (!role) {
            return interaction.reply({ content: 'The verification role no longer exists on this server!', ephemeral: true });
          }
          
          // Ensure we have a full GuildMember object, not an APIInteractionGuildMember
          const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
          if (!member) {
            return interaction.reply({ content: 'Could not resolve your server profile.', ephemeral: true });
          }

          if (member.roles.cache.has(role.id)) {
            return interaction.reply({ content: 'You are already verified!', ephemeral: true });
          }
          
          await member.roles.add(role);
          return interaction.reply({ content: `<a:emoji_18:1517214419996643509> You have been successfully verified! Access granted.`, ephemeral: true });
        } catch (err) {
          console.error('Verify error:', err);
          return interaction.reply({ content: 'I do not have permission to assign the verification role. Please contact an admin.', ephemeral: true }).catch(() => null);
        }
      }

      // Ticket Open Button
      if (interaction.customId === 'ticket_open') {
        try {
          const ticketConfig = db.getTickets(interaction.guild.id);
          if (!ticketConfig || !ticketConfig.categoryId) {
            return interaction.reply({ content: 'The ticket system is not fully configured.', ephemeral: true });
          }

          const category = interaction.guild.channels.cache.get(ticketConfig.categoryId);
          if (!category) {
            return interaction.reply({ content: 'The ticket category could not be found.', ephemeral: true });
          }

          // Ensure activeTickets is an object
          const activeTickets = ticketConfig.activeTickets || {};

          // Check if user already has an active ticket
          for (const [tId, ticket] of Object.entries(activeTickets)) {
            if (ticket.ownerId === interaction.user.id) {
              return interaction.reply({ content: `You already have an open ticket in <#${ticket.textId}>!`, ephemeral: true });
            }
          }

        await interaction.deferReply({ ephemeral: true });

        try {
          const permissionOverwrites = [
            {
              id: interaction.guild.id, // @everyone
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: interaction.user.id, // Ticket creator
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
            },
            {
              id: interaction.client.user.id, // Bot
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
            }
          ];

          if (ticketConfig.staffRoleId) {
            permissionOverwrites.push({
              id: ticketConfig.staffRoleId, // Staff
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
            });
          }

          // Create Text Channel
          const textChannel = await interaction.guild.channels.create({
            name: `🎫-ticket-${interaction.user.username}`,
            type: 0, // GUILD_TEXT
            parent: category.id,
            permissionOverwrites
          });

          // Create Voice Channel
          const voiceChannel = await interaction.guild.channels.create({
            name: `🔊 Ticket Voice`,
            type: 2, // GUILD_VOICE
            parent: category.id,
            permissionOverwrites
          });

          const ticketId = db.createTicket(interaction.guild.id, textChannel.id, voiceChannel.id, interaction.user.id);

          const ticketEmbed = embed.info(
            `Ticket #${ticketId}`,
            `Welcome ${interaction.user}!\n\nA staff member will be with you shortly. You have a dedicated text channel here, and a dedicated voice channel: <#${voiceChannel.id}>.\n\nClick the button below to close this ticket.`
          );

          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
          const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_close_${ticketId}`)
              .setLabel('Close Ticket')
              .setEmoji('<a:emoji_106:1517212811678453942>')
              .setStyle(ButtonStyle.Danger)
          );

          await textChannel.send({
            content: ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : undefined,
            embeds: [ticketEmbed],
            components: [closeRow]
          });

          return interaction.editReply({ content: `Your ticket has been created: <#${textChannel.id}>` });
        } catch (err) {
          console.error('Error creating ticket:', err);
          return interaction.editReply({ content: 'An error occurred while trying to create your ticket channels.' });
        }
      } catch (err) {
        console.error('Ticket open error:', err);
        if (!interaction.replied && !interaction.deferred) {
          return interaction.reply({ content: 'An unexpected error occurred while processing your ticket.', ephemeral: true }).catch(() => null);
        }
      }
    }

      // Ticket Close Button
      if (interaction.customId.startsWith('ticket_close_')) {
        const ticketId = interaction.customId.replace('ticket_close_', '');
        const ticketConfig = db.getTickets(interaction.guild.id);
        const ticketData = ticketConfig.activeTickets[ticketId];

        if (!ticketData) {
          return interaction.reply({ content: 'This ticket is no longer tracked in the database.', ephemeral: true });
        }

        // To prevent misclicks, let's defer update and immediately delete the channels
        await interaction.deferUpdate();

        try {
          const textChannel = interaction.guild.channels.cache.get(ticketData.textId);
          const voiceChannel = interaction.guild.channels.cache.get(ticketData.voiceId);

          if (textChannel) await textChannel.delete();
          if (voiceChannel) await voiceChannel.delete();

          db.removeTicket(interaction.guild.id, ticketId);
        } catch (err) {
          console.error('Error deleting ticket channels:', err);
        }
        return;
      }

      // Giveaway Join Button
      if (interaction.customId === 'gw_join') {
        const gwData = db.getGiveaway(interaction.message.id);
        if (!gwData) {
          return interaction.reply({ content: 'This giveaway has already ended or is invalid!', ephemeral: true });
        }
        
        const joined = db.addGiveawayParticipant(interaction.message.id, interaction.user.id);
        
        // Update embed footer with new entry count
        const newCount = db.getGiveaway(interaction.message.id).participants.length;
        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = { ...originalEmbed.data, footer: { text: `${newCount} Entries` } };
        
        await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => null);

        if (joined) {
          return interaction.reply({ content: `<a:emoji_56:1517212375022047284> You have successfully entered the giveaway!`, ephemeral: true });
        } else {
          return interaction.reply({ content: `You have successfully left the giveaway.`, ephemeral: true });
        }
      }

      // Antinuke config panel buttons
      const validButtons = ['toggle_antinuke', 'toggle_spam', 'toggle_invite', 'toggle_blacklist_filter', 'cycle_punishment', 'save_panel'];

      // Spam "Send 5 More" button
      if (interaction.customId.startsWith('spam_more_')) {
        try {
          await handleSpamMoreButton(interaction);
        } catch (error) {
          console.error('Error handling spam more button:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '\u274c Failed to send more spam.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      // Welcome/Leave Manager buttons
      if (interaction.customId.startsWith('welcmgr_') || interaction.customId.startsWith('leavmgr_')) {
        try {
          await handleWelcomeManagerButton(interaction);
        } catch (error) {
          console.error('Error handling Welcome button:', error);
        }
        return;
      }

      // Accent color buttons
      if (interaction.customId.startsWith('accent_')) {
        try {
          await handleAccentButton(interaction);
        } catch (error) {
          console.error('Error handling Accent button:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Failed to process accent action.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      if (!validButtons.includes(interaction.customId)) {
        // JTC control panel buttons
        if (interaction.customId.startsWith('jtc_setlimit_')) {
          try { await handleJtcLimitSelect(interaction); } catch (e) { console.error('[JTC limit]', e); }
          return;
        }
        if (interaction.customId.startsWith('jtc_setbitrate_')) {
          try { await handleJtcBitrateSelect(interaction); } catch (e) { console.error('[JTC bitrate]', e); }
          return;
        }
        if (interaction.customId.startsWith('jtc_')) {
          try { await handleJtcButton(interaction); } catch (e) { console.error('[JTC button]', e); }
          return;
        }
        return;
      }

      // Verify Administrator permissions for config buttons — bot owner + extra owners bypass
      const isBtnBypass = isBotOwnerSync(interaction.user.id) ||
        interaction.user.id === interaction.guild.ownerId ||
        db.isExtraOwner(interaction.guild.id, interaction.user.id);

      if (!isBtnBypass && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '🛡️ Access Denied: You must possess the **Administrator** permission to adjust security panel configurations.',
          ephemeral: true
        });
      }

      const guildId = interaction.guild.id;
      const config = db.getGuildConfig(guildId);

      // Enforce dynamic adjustments on database disk cache
      if (interaction.customId === 'toggle_antinuke') {
        db.updateGuildConfig(guildId, { antiNukeEnabled: !config.antiNukeEnabled });
      } else if (interaction.customId === 'toggle_spam') {
        db.updateGuildConfig(guildId, { antiSpamEnabled: !config.antiSpamEnabled });
      } else if (interaction.customId === 'toggle_invite') {
        const inviteState = config.antiInviteEnabled !== false;
        db.updateGuildConfig(guildId, { antiInviteEnabled: !inviteState });
      } else if (interaction.customId === 'toggle_blacklist_filter') {
        const blacklistState = config.blacklistWords && config.blacklistWords.length > 0;
        if (blacklistState) {
          db.updateGuildConfig(guildId, { blacklistWords: [] });
        } else {
          // Default Swear filter words trigger
          db.addBlacklistWord(guildId, 'hack');
          db.addBlacklistWord(guildId, 'nuke');
          db.addBlacklistWord(guildId, 'spam');
        }
      } else if (interaction.customId === 'cycle_punishment') {
        const punishments = ['ban', 'kick', 'quarantine'];
        const currentIdx = punishments.indexOf(config.antiNukePunishment || 'ban');
        const nextIdx = (currentIdx + 1) % punishments.length;
        db.updateGuildConfig(guildId, { antiNukePunishment: punishments[nextIdx] });
      } else if (interaction.customId === 'save_panel') {
        const panel = await getAntinukeConfigPanel(interaction.guild);
        panel.components.forEach(row => row.components.forEach(btn => btn.setDisabled(true)));
        panel.embed.data.description = '**✅ Panel configuration has been saved and is now being actively enforced.**';
        panel.embed.data.color = 0x2ECC71; // Success green color
        return interaction.update({ embeds: [panel.embed], components: panel.components });
      }

      // Re-compile layout and update message
      const panel = await getAntinukeConfigPanel(interaction.guild);
      await interaction.update({ embeds: [panel.embed], components: panel.components });
    }

    // ==========================================
    // 4. STRING SELECT MENU (JTC Dropdowns)
    // ==========================================
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'jtc_settings_menu' || interaction.customId === 'jtc_perms_menu') {
        try {
          await handleJtcSelectMenu(interaction);
        } catch (err) {
          console.error('[JTC SelectMenu]', err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => null);
          }
        }
      }
    }

    // ==========================================
    // 5. CHANNEL SELECT MENU (Welcome/Leave)
    // ==========================================
    if (interaction.isChannelSelectMenu()) {
      if (interaction.customId === 'welcmgr_channel' || interaction.customId === 'leavmgr_channel') {
        try {
          await handleWelcomeManagerMenu(interaction);
        } catch (err) {
          console.error('[Welcome SelectMenu]', err);
        }
        return;
      }
    }
  }
};
