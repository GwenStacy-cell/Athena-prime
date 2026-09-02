import db from '../database.js';

export default {
  name: 'presenceUpdate',
  async execute(oldPresence, newPresence) {
    if (!newPresence || !newPresence.guild || !newPresence.member) return;
    
    const config = db.getGuildConfig(newPresence.guild.id);
    if (!config || !config.vanityString || !config.vanityRole) return;

    // A user might have multiple activities (playing a game, custom status, etc)
    const customStatus = newPresence.activities.find(activity => activity.type === 4); // 4 = Custom Status
    
    const rawVanityRoles = Array.isArray(config.vanityRole) ? config.vanityRole : [config.vanityRole];
    const rolesToManage = [];
    for (const rId of rawVanityRoles) {
      const role = newPresence.guild.roles.cache.get(rId);
      if (role && role.editable) rolesToManage.push(role);
    }
    if (rolesToManage.length === 0) return;

    const hasVanityInStatus = customStatus && customStatus.state && customStatus.state.includes(config.vanityString);
    const hasAnyRole = rolesToManage.some(r => newPresence.member.roles.cache.has(r.id));

    if (hasVanityInStatus && !hasAnyRole) {
      // Award the vanity roles
      await newPresence.member.roles.add(rolesToManage, 'Athena Prime: Vanity Status Award').catch(() => null);
    } else if (!hasVanityInStatus && hasAnyRole) {
      // Strip the vanity roles
      await newPresence.member.roles.remove(rolesToManage, 'Athena Prime: Vanity Status Removed').catch(() => null);
    }
  }
};
