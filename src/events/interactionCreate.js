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
