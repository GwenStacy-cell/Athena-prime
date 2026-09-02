import fs from "fs";
let js = fs.readFileSync("src/events/presenceUpdate.js", "utf8");

const oldLogic = `    const role = newPresence.guild.roles.cache.get(config.vanityRole);
    if (!role || !role.editable) return;

    const hasVanityInStatus = customStatus && customStatus.state && customStatus.state.includes(config.vanityString);
    const hasRole = newPresence.member.roles.cache.has(config.vanityRole);

    if (hasVanityInStatus && !hasRole) {
      // Award the vanity role
      await newPresence.member.roles.add(role, 'Athena Prime: Vanity Status Award').catch(() => null);
    } else if (!hasVanityInStatus && hasRole) {
      // Strip the vanity role
      await newPresence.member.roles.remove(role, 'Athena Prime: Vanity Status Removed').catch(() => null);
    }`;

const newLogic = `    const rawVanityRoles = Array.isArray(config.vanityRole) ? config.vanityRole : [config.vanityRole];
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
    }`;

js = js.replace(oldLogic, newLogic);
fs.writeFileSync("src/events/presenceUpdate.js", js);
