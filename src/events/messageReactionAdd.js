import db from '../database.js';
import embed from '../embed.js';

export default {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    if (user.bot) return;

    // Fetch partials if needed
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('Something went wrong when fetching the reaction:', error);
        return;
      }
    }

    const menu = db.getReactionRoleMenu(reaction.message.id);
    if (!menu) return;

    // Resolve Emoji Identifier (unicode or custom ID)
    const emojiIdOrName = reaction.emoji.id || reaction.emoji.name;
    const roleId = menu.mappings[emojiIdOrName];
    if (!roleId) return;

    try {
      const guild = reaction.message.guild || await reaction.client.guilds.fetch(menu.guildId).catch(() => null);
      if (!guild) return;

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      let role = guild.roles.cache.get(roleId);
      if (!role) {
        // Attempt to fetch if not in cache
        const fetchedRoles = await guild.roles.fetch();
        role = fetchedRoles.get(roleId);
      }
      if (!role) return;

      await member.roles.add(role, `Reaction Role: ${menu.title}`);

      const config = db.getGuildConfig(guild.id);
      if (config.rrDmsEnabled) {
        await user.send({
          embeds: [embed.success('Role Granted', `You have been given the **${role.name}** role in **${guild.name}**.`)]
        }).catch(() => null);
      }
    } catch (err) {
      console.error('Failed to grant reaction role:', err);
      // Attempt to DM the user about the error
      await user.send({
        embeds: [embed.error('Reaction Role Error', `I was unable to give you the role in **${reaction.message.guild?.name || 'the server'}**. This usually happens because my bot role is lower than the role you are trying to get, or I am missing the "Manage Roles" permission.`)]
      }).catch(() => null);
    }
  }
};
