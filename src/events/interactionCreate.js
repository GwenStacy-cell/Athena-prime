import { PermissionFlagsBits } from 'discord.js';
import commandMap from '../commands/loader.js';
import embed from '../embed.js';
import db from '../database.js';
import { getAntinukeConfigPanel } from '../commands/security.js';
import { handleEnukeButton, handleEnukeModal } from '../commands/enuke.js';
import { handleSpamModal, handleSpamMoreButton } from '../commands/spam.js';
import { isBotOwnerSync } from '../utils/helpers.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    // ==========================================
    // 1. CHAT INPUT SLASH COMMANDS
    // ==========================================
    if (interaction.isChatInputCommand()) {
      const cmd = commandMap.get(interaction.commandName);
      if (!cmd) {
        return interaction.reply({
          embeds: [embed.warn('Unknown Command', `${interaction.user} ❌ The command \`/${interaction.commandName}\` was not recognized.\n\nUse \`/help\` to see all available commands.`)],
          ephemeral: true
        });
      }

      // Verify permissions — bot owner bypasses all permission checks in every server
      if (cmd.permissions && cmd.permissions.length > 0) {
        if (!isBotOwnerSync(interaction.user.id)) {
          const hasPerms = cmd.permissions.every(perm => interaction.member.permissions.has(perm));
          if (!hasPerms) {
            return interaction.reply({
              embeds: [embed.danger('Access Denied', `${interaction.user} 🛡️ You do not possess the required permissions to execute this security command.\n\n**Required:** ${cmd.permissions.map(p => `\`${Object.entries(PermissionFlagsBits).find(([, v]) => v === p)?.[0] || 'Unknown'}\``).join(', ')}`)],
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
    }

    // ==========================================
    // 3. INTERACTIVE COMPONENT BUTTON CLICKS
    // ==========================================
    if (interaction.isButton()) {
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
      const validButtons = ['toggle_antinuke', 'toggle_spam', 'toggle_invite', 'toggle_blacklist_filter', 'cycle_punishment'];

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

      if (!validButtons.includes(interaction.customId)) return;

      // Verify Administrator permissions for config buttons — bot owner bypasses
      if (!isBotOwnerSync(interaction.user.id) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
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
      }

      // Re-compile layout and update message
      const panel = await getAntinukeConfigPanel(interaction.guild);
      await interaction.update({ embeds: [panel.embed], components: panel.components });
    }
  }
};
