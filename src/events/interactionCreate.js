import { PermissionFlagsBits } from 'discord.js';
import commandMap from '../commands/loader.js';
import embed from '../embed.js';
import db from '../database.js';
import { getAntinukeConfigPanel } from '../commands/security.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    // ==========================================
    // 1. CHAT INPUT SLASH COMMANDS
    // ==========================================
    if (interaction.isChatInputCommand()) {
      const cmd = commandMap.get(interaction.commandName);
      if (!cmd) return;

      // Verify permissions
      if (cmd.permissions && cmd.permissions.length > 0) {
        const hasPerms = cmd.permissions.every(perm => interaction.member.permissions.has(perm));
        if (!hasPerms) {
          return interaction.reply({
            embeds: [embed.danger('Access Denied', '🛡️ You do not possess the required permissions to execute this security command.')],
            ephemeral: true
          });
        }
      }

      try {
        await cmd.executeSlash(interaction);
      } catch (error) {
        console.error(`Error executing command ${cmd.name} via Slash:`, error);
        const errEmbed = embed.danger(
          'Execution Error', 
          'An unexpected error occurred while executing this slash command.'
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
    // 2. INTERACTIVE COMPONENT BUTTON CLICKS
    // ==========================================
    if (interaction.isButton()) {
      const validButtons = ['toggle_antinuke', 'toggle_spam', 'toggle_invite', 'toggle_blacklist_filter', 'cycle_punishment'];
      if (!validButtons.includes(interaction.customId)) return;

      // Verify Administrator permissions for config buttons
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
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
