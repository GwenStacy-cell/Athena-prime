import db from '../database.js';

export default {
  name: 'presenceUpdate',
  async execute(oldPresence, newPresence) {
    if (!newPresence || !newPresence.guild || !newPresence.member) return;
    
    const config = db.getGuildConfig(newPresence.guild.id);
    if (!config || !config.vanityString || !config.vanityRole) return;

    // A user might have multiple activities (playing a game, custom status, etc)
    const customStatus = newPresence.activities.find(activity => activity.type === 4); // 4 = Custom Status
    
    const role = newPresence.guild.roles.cache.get(config.vanityRole);
    if (!role || !role.editable) return;

    const hasVanityInStatus = customStatus && customStatus.state && customStatus.state.includes(config.vanityString);
    const hasRole = newPresence.member.roles.cache.has(config.vanityRole);

    if (hasVanityInStatus && !hasRole) {
      // Award the vanity role
      await newPresence.member.roles.add(role, 'Athena Prime: Vanity Status Award').catch(() => null);
    } else if (!hasVanityInStatus && hasRole) {
      // Strip the vanity role
      await newPresence.member.roles.remove(role, 'Athena Prime: Vanity Status Removed').catch(() => null);
    }
  }
};
