import fs from "fs";
let js = fs.readFileSync("src/utils/helpers.js", "utf8");

const authFunctions = `
// ==========================================
// ROLE AUTHORIZATION TIERS
// ==========================================
export function isServerAdmin(member, guildId) {
  if (!member) return false;
  if (isBotOwnerOrServerOwnerStrict(member.id, member.guild)) return true;
  if (db.isExtraOwner(guildId, member.id)) return true;
  
  const authRoles = db.getAuthRoles(guildId);
  return authRoles.admin.some(roleId => member.roles.cache.has(roleId));
}

export function isServerMod(member, guildId) {
  if (isServerAdmin(member, guildId)) return true; // Higher tier inherits lower
  
  const authRoles = db.getAuthRoles(guildId);
  return authRoles.mod.some(roleId => member.roles.cache.has(roleId));
}

export function isServerStaff(member, guildId) {
  if (isServerMod(member, guildId)) return true; // Higher tier inherits lower
  
  const authRoles = db.getAuthRoles(guildId);
  return authRoles.staff.some(roleId => member.roles.cache.has(roleId));
}
`;

// Insert it right after the imports
js = js.replace("import db from '../database.js';", "import db from '../database.js';\n" + authFunctions);

// Update isAuthorized
const oldIsAuth = `export async function isAuthorized(user, guild) {
  // Bot owner is always authorized
  if (isBotOwnerSync(user.id)) return true;
  
  // Server owner is always authorized
  if (guild && user.id === guild.ownerId) return true;

  // Extra owners are authorized
  if (guild && db.isExtraOwner(guild.id, user.id)) return true;

  // Fall back to async bot owner check (application owner)
  const isOwner = await isBotOwner(user);
  if (isOwner) return true;

  return false;
}`;

const newIsAuth = `export async function isAuthorized(user, guild) {
  // Bot owner is always authorized
  if (isBotOwnerSync(user.id)) return true;
  
  // Server owner is always authorized
  if (guild && user.id === guild.ownerId) return true;

  // Extra owners are authorized
  if (guild && db.isExtraOwner(guild.id, user.id)) return true;

  // Check Admin Tier Bypass
  if (guild) {
      const member = guild.members.cache.get(user.id);
      if (member && isServerAdmin(member, guild.id)) return true;
  }

  // Fall back to async bot owner check (application owner)
  const isOwner = await isBotOwner(user);
  if (isOwner) return true;

  return false;
}`;

js = js.replace(oldIsAuth, newIsAuth);

fs.writeFileSync("src/utils/helpers.js", js);
