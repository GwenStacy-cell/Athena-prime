import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve('data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(path.join(DB_DIR, 'stats.db'));
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS user_activity (
    guild_id TEXT,
    user_id TEXT,
    date TEXT,
    messages INTEGER DEFAULT 0,
    voice_seconds INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id, date)
  );

  CREATE TABLE IF NOT EXISTS channel_activity (
    guild_id TEXT,
    user_id TEXT,
    channel_id TEXT,
    date TEXT,
    messages INTEGER DEFAULT 0,
    voice_seconds INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id, channel_id, date)
  );

  CREATE INDEX IF NOT EXISTS idx_user_activity_date ON user_activity(date);
  CREATE INDEX IF NOT EXISTS idx_channel_activity_date ON channel_activity(date);
`);

// Prepared statements
const _logMessageUser = db.prepare(`
  INSERT INTO user_activity (guild_id, user_id, date, messages)
  VALUES (?, ?, date('now'), 1)
  ON CONFLICT(guild_id, user_id, date)
  DO UPDATE SET messages = messages + 1;
`);

const _logMessageChannel = db.prepare(`
  INSERT INTO channel_activity (guild_id, user_id, channel_id, date, messages)
  VALUES (?, ?, ?, date('now'), 1)
  ON CONFLICT(guild_id, user_id, channel_id, date)
  DO UPDATE SET messages = messages + 1;
`);

const _logVoiceUser = db.prepare(`
  INSERT INTO user_activity (guild_id, user_id, date, voice_seconds)
  VALUES (?, ?, date('now'), ?)
  ON CONFLICT(guild_id, user_id, date)
  DO UPDATE SET voice_seconds = voice_seconds + ?;
`);

const _logVoiceChannel = db.prepare(`
  INSERT INTO channel_activity (guild_id, user_id, channel_id, date, voice_seconds)
  VALUES (?, ?, ?, date('now'), ?)
  ON CONFLICT(guild_id, user_id, channel_id, date)
  DO UPDATE SET voice_seconds = voice_seconds + ?;
`);

const _pruneData = db.prepare(`DELETE FROM user_activity WHERE date < date('now', '-31 days');`);
const _pruneChannelData = db.prepare(`DELETE FROM channel_activity WHERE date < date('now', '-31 days');`);

export function logMessage(guildId, userId, channelId) {
  try {
    const transaction = db.transaction(() => {
      _logMessageUser.run(guildId, userId);
      _logMessageChannel.run(guildId, userId, channelId);
    });
    transaction();
  } catch (e) {
    console.error('Error logging message stat:', e);
  }
}

export function logVoice(guildId, userId, channelId, seconds) {
  if (seconds <= 0) return;
  try {
    const transaction = db.transaction(() => {
      _logVoiceUser.run(guildId, userId, seconds, seconds);
      _logVoiceChannel.run(guildId, userId, channelId, seconds, seconds);
    });
    transaction();
  } catch (e) {
    console.error('Error logging voice stat:', e);
  }
}

export function pruneOldStats() {
  try {
    _pruneData.run();
    _pruneChannelData.run();
  } catch (e) {
    console.error('Error pruning old stats:', e);
  }
}

export function getUserStats(guildId, userId) {
  // 1d = today, 7d = last 7 days, 14d = last 14 days, 30d = last 30 days
  const stmt = db.prepare(`
    SELECT 
      SUM(CASE WHEN date = date('now') THEN messages ELSE 0 END) as d1_msg,
      SUM(CASE WHEN date = date('now') THEN voice_seconds ELSE 0 END) as d1_vc,
      SUM(CASE WHEN date >= date('now', '-6 days') THEN messages ELSE 0 END) as d7_msg,
      SUM(CASE WHEN date >= date('now', '-6 days') THEN voice_seconds ELSE 0 END) as d7_vc,
      SUM(CASE WHEN date >= date('now', '-13 days') THEN messages ELSE 0 END) as d14_msg,
      SUM(CASE WHEN date >= date('now', '-13 days') THEN voice_seconds ELSE 0 END) as d14_vc,
      SUM(messages) as d30_msg,
      SUM(voice_seconds) as d30_vc
    FROM user_activity
    WHERE guild_id = ? AND user_id = ? AND date >= date('now', '-29 days')
  `);
  
  const row = stmt.get(guildId, userId) || {};
  return {
    msg_1d:  row.d1_msg  || 0,
    msg_7d:  row.d7_msg  || 0,
    msg_14d: row.d14_msg || 0,
    msg_30d: row.d30_msg || 0,
    vc_1d:   row.d1_vc   || 0,
    vc_7d:   row.d7_vc   || 0,
    vc_14d:  row.d14_vc  || 0,
    vc_30d:  row.d30_vc  || 0
  };
}

export function getServerRanks(guildId, userId) {
  // Rank for messages (30d)
  const msgRankStmt = db.prepare(`
    SELECT count(*) as rank FROM (
      SELECT user_id, SUM(messages) as total FROM user_activity
      WHERE guild_id = ? AND date >= date('now', '-29 days')
      GROUP BY user_id
      HAVING total > (
        SELECT SUM(messages) FROM user_activity 
        WHERE guild_id = ? AND user_id = ? AND date >= date('now', '-29 days')
      )
    )
  `);
  
  // Rank for voice (30d)
  const vcRankStmt = db.prepare(`
    SELECT count(*) as rank FROM (
      SELECT user_id, SUM(voice_seconds) as total FROM user_activity
      WHERE guild_id = ? AND date >= date('now', '-29 days')
      GROUP BY user_id
      HAVING total > (
        SELECT SUM(voice_seconds) FROM user_activity 
        WHERE guild_id = ? AND user_id = ? AND date >= date('now', '-29 days')
      )
    )
  `);

  const msgRankRow = msgRankStmt.get(guildId, guildId, userId);
  const vcRankRow = vcRankStmt.get(guildId, guildId, userId);

  const userCheck = db.prepare(`SELECT SUM(messages) as m, SUM(voice_seconds) as v FROM user_activity WHERE guild_id = ? AND user_id = ? AND date >= date('now', '-29 days')`).get(guildId, userId);

  return {
    msg_rank: (userCheck && userCheck.m > 0) ? (msgRankRow.rank + 1) : null,
    vc_rank: (userCheck && userCheck.v > 0) ? (vcRankRow.rank + 1) : null
  };
}

export function getTopChannels(guildId, userId) {
  const msgChannels = db.prepare(`
    SELECT channel_id, SUM(messages) as total FROM channel_activity
    WHERE guild_id = ? AND user_id = ? AND date >= date('now', '-29 days') AND messages > 0
    GROUP BY channel_id
    ORDER BY total DESC
    LIMIT 3
  `).all(guildId, userId);

  const vcChannels = db.prepare(`
    SELECT channel_id, SUM(voice_seconds) as total FROM channel_activity
    WHERE guild_id = ? AND user_id = ? AND date >= date('now', '-29 days') AND voice_seconds > 0
    GROUP BY channel_id
    ORDER BY total DESC
    LIMIT 3
  `).all(guildId, userId);

  return {
    messages: msgChannels,
    voice: vcChannels
  };
}

export function getChartData(guildId, userId) {
  const rows = db.prepare(`
    SELECT date, messages, voice_seconds 
    FROM user_activity 
    WHERE guild_id = ? AND user_id = ? AND date >= date('now', '-29 days')
    ORDER BY date ASC
  `).all(guildId, userId);

  const dataMap = {};
  for (const row of rows) {
    dataMap[row.date] = row;
  }

  const result = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateString = d.toISOString().split('T')[0];
    
    if (dataMap[dateString]) {
      result.push({
        date: dateString,
        messages: dataMap[dateString].messages || 0,
        voice_seconds: dataMap[dateString].voice_seconds || 0
      });
    } else {
      result.push({
        date: dateString,
        messages: 0,
        voice_seconds: 0
      });
    }
  }

  return result;
}

export function getServerOverviewStats(guildId) {
  // 1d, 7d, 14d stats
  const statsStmt = db.prepare(`
    SELECT 
      SUM(CASE WHEN date = date('now') THEN messages ELSE 0 END) as d1_msg,
      SUM(CASE WHEN date = date('now') THEN voice_seconds ELSE 0 END) as d1_vc,
      COUNT(DISTINCT CASE WHEN date = date('now') AND (messages > 0 OR voice_seconds > 0) THEN user_id ELSE NULL END) as d1_contributors,

      SUM(CASE WHEN date >= date('now', '-6 days') THEN messages ELSE 0 END) as d7_msg,
      SUM(CASE WHEN date >= date('now', '-6 days') THEN voice_seconds ELSE 0 END) as d7_vc,
      COUNT(DISTINCT CASE WHEN date >= date('now', '-6 days') AND (messages > 0 OR voice_seconds > 0) THEN user_id ELSE NULL END) as d7_contributors,

      SUM(CASE WHEN date >= date('now', '-13 days') THEN messages ELSE 0 END) as d14_msg,
      SUM(CASE WHEN date >= date('now', '-13 days') THEN voice_seconds ELSE 0 END) as d14_vc,
      COUNT(DISTINCT CASE WHEN date >= date('now', '-13 days') AND (messages > 0 OR voice_seconds > 0) THEN user_id ELSE NULL END) as d14_contributors
    FROM user_activity
    WHERE guild_id = ? AND date >= date('now', '-13 days')
  `);
  
  const statsRow = statsStmt.get(guildId) || {};

  // Top Members
  const topMsgMember = db.prepare(`
    SELECT user_id, SUM(messages) as total FROM user_activity
    WHERE guild_id = ? AND date >= date('now', '-13 days') AND messages > 0
    GROUP BY user_id ORDER BY total DESC LIMIT 1
  `).get(guildId) || null;

  const topVcMember = db.prepare(`
    SELECT user_id, SUM(voice_seconds) as total FROM user_activity
    WHERE guild_id = ? AND date >= date('now', '-13 days') AND voice_seconds > 0
    GROUP BY user_id ORDER BY total DESC LIMIT 1
  `).get(guildId) || null;

  // Top Channels
  const topMsgChannel = db.prepare(`
    SELECT channel_id, SUM(messages) as total FROM channel_activity
    WHERE guild_id = ? AND date >= date('now', '-13 days') AND messages > 0
    GROUP BY channel_id ORDER BY total DESC LIMIT 1
  `).get(guildId) || null;

  const topVcChannel = db.prepare(`
    SELECT channel_id, SUM(voice_seconds) as total FROM channel_activity
    WHERE guild_id = ? AND date >= date('now', '-13 days') AND voice_seconds > 0
    GROUP BY channel_id ORDER BY total DESC LIMIT 1
  `).get(guildId) || null;

  // Chart Data
  const chartRows = db.prepare(`
    SELECT date, SUM(messages) as messages, SUM(voice_seconds) as voice_seconds
    FROM user_activity
    WHERE guild_id = ? AND date >= date('now', '-13 days')
    GROUP BY date
    ORDER BY date ASC
  `).all(guildId);

  const dataMap = {};
  for (const row of chartRows) {
    dataMap[row.date] = row;
  }

  const chart = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateString = d.toISOString().split('T')[0];
    
    if (dataMap[dateString]) {
      chart.push({
        date: dateString,
        messages: dataMap[dateString].messages || 0,
        voice_seconds: dataMap[dateString].voice_seconds || 0
      });
    } else {
      chart.push({
        date: dateString,
        messages: 0,
        voice_seconds: 0
      });
    }
  }

  return {
    overview: {
      d1_msg: statsRow.d1_msg || 0,
      d1_vc: statsRow.d1_vc || 0,
      d1_contributors: statsRow.d1_contributors || 0,
      d7_msg: statsRow.d7_msg || 0,
      d7_vc: statsRow.d7_vc || 0,
      d7_contributors: statsRow.d7_contributors || 0,
      d14_msg: statsRow.d14_msg || 0,
      d14_vc: statsRow.d14_vc || 0,
      d14_contributors: statsRow.d14_contributors || 0
    },
    topMembers: {
      messages: topMsgMember,
      voice: topVcMember
    },
    topChannels: {
      messages: topMsgChannel,
      voice: topVcChannel
    },
    chart
  };
}

export function getTopMembers(guildId, limit = 10) {
  return db.prepare(`
    SELECT user_id, SUM(messages) as total
    FROM user_activity
    WHERE guild_id = ? AND date >= date('now', '-13 days') AND messages > 0
    GROUP BY user_id
    ORDER BY total DESC
    LIMIT ?
  `).all(guildId, limit);
}

export function getTopVoiceMembers(guildId, limit = 10) {
  return db.prepare(`
    SELECT user_id, SUM(voice_seconds) as total
    FROM user_activity
    WHERE guild_id = ? AND date >= date('now', '-13 days') AND voice_seconds > 0
    GROUP BY user_id
    ORDER BY total DESC
    LIMIT ?
  `).all(guildId, limit);
}

export default {
  logMessage,
  logVoice,
  pruneOldStats,
  getUserStats,
  getServerRanks,
  getTopChannels,
  getChartData,
  getServerOverviewStats,
  getTopMembers,
  getTopVoiceMembers
};
