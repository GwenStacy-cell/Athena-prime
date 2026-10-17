/**
 * Multi-Turn Conversational Memory & Context Threading Engine for Athena Prime.
 * Provides a lightweight rolling session cache keyed by guildId:userId:channelId with live Discord countdown timers.
 */

const guideSessions = new Map();
export const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes rolling limit

/**
 * Generates an isolated session composite key
 */
function makeSessionKey(guildId = '0', userId = '0', channelId = '0') {
  return `${guildId}:${userId}:${channelId}`;
}

/**
 * Retrieves the active session for a user in a channel, or returns null if expired or nonexistent
 */
export function getGuideSession(guildId, userId, channelId) {
  if (!userId) return null;
  const key = makeSessionKey(guildId, userId, channelId);
  const session = guideSessions.get(key);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    guideSessions.delete(key);
    return null;
  }
  return session;
}

/**
 * Records a new conversation turn, refreshes the rolling 10-minute timer, and archives the exchange
 */
export function recordGuideTurn(guildId, userId, channelId, userPrompt, aiResult = {}) {
  if (!userId) return null;
  const key = makeSessionKey(guildId, userId, channelId);
  let session = getGuideSession(guildId, userId, channelId);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  if (!session) {
    session = {
      guildId,
      userId,
      channelId,
      turnCount: 0,
      createdAt: now,
      expiresAt,
      turns: [],
      primaryCommands: [],
      suggestedFollowUps: []
    };
  } else {
    session.expiresAt = expiresAt;
  }

  session.turnCount += 1;

  if (aiResult.suggestions && Array.isArray(aiResult.suggestions)) {
    session.suggestedFollowUps = aiResult.suggestions;
  }

  // Extract primary command from matched commands or aiResult
  let detectedCmd = '';
  if (aiResult.matchedCommands && aiResult.matchedCommands.length > 0) {
    detectedCmd = aiResult.matchedCommands[0].name;
  } else if (aiResult.primaryCommand) {
    detectedCmd = aiResult.primaryCommand;
  }

  if (detectedCmd && !session.primaryCommands.includes(detectedCmd)) {
    session.primaryCommands.unshift(detectedCmd);
    if (session.primaryCommands.length > 4) session.primaryCommands.pop();
  }
  session.primaryCommand = detectedCmd || session.primaryCommands[0] || null;
  session.lastTopic = session.primaryCommand;

  // Create compact summary for history injection
  const summaryText = (aiResult.text || '')
    .split('\n')
    .filter(l => l.includes('**__') || l.includes('`!'))
    .slice(0, 4)
    .join(' ')
    .slice(0, 300);

  session.turns.push({
    turnNumber: session.turnCount,
    userPrompt: (userPrompt || '').trim(),
    assistantSummary: summaryText || (aiResult.text || '').slice(0, 250),
    primaryCommand: detectedCmd,
    timestamp: now
  });

  // Keep last 3 turns to prevent token bloat while maintaining seamless continuity
  if (session.turns.length > 3) {
    session.turns = session.turns.slice(-3);
  }

  session.lastUpdated = now;
  guideSessions.set(key, session);
  return session;
}

/**
 * Resets/clears the conversational memory for a user in a channel
 */
export function clearGuideSession(guildId, userId, channelId) {
  const key = makeSessionKey(guildId, userId, channelId);
  return guideSessions.delete(key);
}

/**
 * Formats the live dynamic countdown timer using Discord relative timestamp syntax
 */
export function formatSessionHeader(session) {
  if (!session) return '';
  const unixSec = Math.floor(session.expiresAt / 1000);
  if (session.turnCount <= 1) {
    return `Turn #1 • Live session: active for 10m (expires <t:${unixSec}:R> at <t:${unixSec}:t>)`;
  }
  return `Turn #${session.turnCount} • Live session: rolling timer expires <t:${unixSec}:R> at <t:${unixSec}:t>`;
}

/**
 * Formats recent conversation turns for injection into the AI prompt
 */
export function formatSessionContextForPrompt(session) {
  if (!session || !session.turns || session.turns.length === 0) return '';
  const lines = [];
  lines.push('--- RECENT CONVERSATION HISTORY IN THIS CHANNEL ---');
  for (const t of session.turns) {
    lines.push(`- Turn #${t.turnNumber}:`);
    lines.push(`  User asked: "${t.userPrompt}"`);
    lines.push(`  Athena key points: "${t.assistantSummary}"`);
    if (t.primaryCommand) lines.push(`  Active Topic Command: !${t.primaryCommand}`);
  }
  lines.push('----------------------------------------------------');
  return lines.join('\n');
}

/**
 * Augments follow-up search queries with the session's active topic commands
 */
export function augmentQueryWithSession(query = '', session = null) {
  if (!session || !session.turns || session.turns.length === 0) return query;

  const clean = query.trim().toLowerCase();
  // Check if query is a follow-up referring to previous context
  const isFollowUp = 
    clean.length < 40 || 
    /\b(it|this|that|those|these|button|buttons|customiz|edit|chang|next|then|how\s+to\s+test|prefix|slash|permiss|clearance)\b/i.test(clean);

  if (isFollowUp && session.primaryCommands.length > 0) {
    const contextualAdditions = session.primaryCommands.join(' ');
    return `${query} ${contextualAdditions}`;
  }
  return query;
}
