import fs from 'fs';
let code = fs.readFileSync('src/statsDB.js', 'utf8');

const targetMethod = "export function logInvite(guildId, inviterId, joinedUserId) {";
const injectMethod = `
const _syncInvites = db.prepare(\`
  INSERT INTO user_invites (guild_id, user_id, regular)
  VALUES (?, ?, ?)
  ON CONFLICT(guild_id, user_id)
  DO UPDATE SET regular = MAX(regular, excluded.regular);
\`);

export function syncRetroactiveInvites(guildId, inviterId, amount) {
  try {
    _syncInvites.run(guildId, inviterId, amount);
  } catch(e) {}
}

`;

code = code.replace(targetMethod, injectMethod + targetMethod);

const targetExport = "  getUserInvites\n};";
const injectExport = "  getUserInvites,\n  syncRetroactiveInvites\n};";
code = code.replace(targetExport, injectExport);

fs.writeFileSync('src/statsDB.js', code);
