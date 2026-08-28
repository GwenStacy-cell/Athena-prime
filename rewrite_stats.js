import fs from 'fs';
let code = fs.readFileSync('src/statsDB.js', 'utf8');

const targetStr = `  CREATE INDEX IF NOT EXISTS idx_channel_activity_date ON channel_activity(date);
\`);

// Prepared statements`;

const replacementStr = `  CREATE INDEX IF NOT EXISTS idx_channel_activity_date ON channel_activity(date);

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
\`);

// Prepared statements`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/statsDB.js', code);
