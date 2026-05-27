import commandMap from '../commands/loader.js';
import embed from '../embed.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const cmd = commandMap.get(interaction.commandName);
    if (!cmd) return;

    // Check permissions
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
  }
};
