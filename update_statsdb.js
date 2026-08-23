import fs from 'fs';
let code = fs.readFileSync('src/statsDB.js', 'utf8');

// Insert table creations
const tablesInject = `
  CREATE TABLE IF NOT EXISTS user_invites (
    guild_id TEXT,
    user_id TEXT,
    regular INTEGER DEFAULT 0,
    leaves INTEGER DEFAULT 0,
    fake INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS join_history (
    guild_id TEXT,
    joined_user_id TEXT,
    inviter_id TEXT,
    PRIMARY KEY (guild_id, joined_user_id)
  );
`;
code = code.replace(/CREATE INDEX IF NOT EXISTS idx_channel_activity_date ON channel_activity\(date\);\n`\);/, "CREATE INDEX IF NOT EXISTS idx_channel_activity_date ON channel_activity(date);\n" + tablesInject + "`\);");


// Add the prepared statements and methods
const methodsInject = `
// ============================================================
// INVITE TRACKING
// ============================================================
const _logInvite = db.prepare(\`
  INSERT INTO user_invites (guild_id, user_id, regular)
  VALUES (?, ?, 1)
  ON CONFLICT(guild_id, user_id)
  DO UPDATE SET regular = regular + 1;
\`);

const _recordJoin = db.prepare(\`
  INSERT OR REPLACE INTO join_history (guild_id, joined_user_id, inviter_id)
  VALUES (?, ?, ?);
\`);

const _getInviter = db.prepare(\`
  SELECT inviter_id FROM join_history WHERE guild_id = ? AND joined_user_id = ?;
\`);

const _logLeave = db.prepare(\`
  UPDATE user_invites SET leaves = leaves + 1 WHERE guild_id = ? AND user_id = ?;
\`);

export function logInvite(guildId, inviterId, joinedUserId) {
  try {
    _logInvite.run(guildId, inviterId);
    _recordJoin.run(guildId, joinedUserId, inviterId);
  } catch (err) {
    console.error('Database Error [logInvite]:', err);
  }
}

export function logLeave(guildId, leavingUserId) {
  try {
    const row = _getInviter.get(guildId, leavingUserId);
    if (row && row.inviter_id) {
      _logLeave.run(guildId, row.inviter_id);
    }
  } catch (err) {
    console.error('Database Error [logLeave]:', err);
  }
}

export function getTopInvites(guildId, limit = 10) {
  return db.prepare(\`
    SELECT user_id, regular, leaves, fake, (regular - leaves - fake) as net
    FROM user_invites
    WHERE guild_id = ? AND (regular - leaves - fake) > 0
    ORDER BY net DESC
    LIMIT ?
  \`).all(guildId, limit);
}

export function getUserInvites(guildId, userId) {
  return db.prepare(\`
    SELECT regular, leaves, fake, (regular - leaves - fake) as net
    FROM user_invites
    WHERE guild_id = ? AND user_id = ?
  \`).get(guildId, userId) || { regular: 0, leaves: 0, fake: 0, net: 0 };
}

`;

code = code.replace(/export default \{/, methodsInject + "\nexport default {");
code = code.replace(/getTopVoiceMembers\n\};/, "getTopVoiceMembers,\n  logInvite,\n  logLeave,\n  getTopInvites,\n  getUserInvites\n};");

fs.writeFileSync('src/statsDB.js', code);
