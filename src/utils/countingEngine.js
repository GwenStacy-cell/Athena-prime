import db from '../database.js';

export const EMOJI_TICK = '<:Bold_White_Check_Mark_on_Black:1560884427620618341>';
export const EMOJI_WRONG = '<:hedwig_wrong:1560881643869306982>';
export const EMOJI_WARN = '<a:zzz_Exclamation:1533859965649817630>';

export const ID_TICK = '1560884427620618341';
export const ID_WRONG = '1560881643869306982';
export const ID_WARN = '1533859965649817630';

/**
 * Safely parses integer or simple arithmetic expressions (+, -, *, /, ^)
 * @param {string} text 
 * @param {boolean} allowMath 
 * @returns {number|null}
 */
export function evaluateCountInput(text, allowMath = true) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();

  // Pure integer
  if (/^-?\d+$/.test(clean)) {
    const val = parseInt(clean, 10);
    return Number.isSafeInteger(val) ? val : null;
  }

  if (!allowMath) return null;

  // Safe arithmetic characters only
  if (!/^[\d\s\+\-\*\/\(\)\^\.]+$/.test(clean)) return null;

  try {
    // Replace ^ with ** for exponentiation
    const sanitized = clean.replace(/\^/g, '**');
    // Function constructor inside restricted sandbox
    const fn = new Function(`"use strict"; return (${sanitized});`);
    const res = fn();
    if (typeof res === 'number' && Number.isFinite(res) && Number.isSafeInteger(Math.round(res))) {
      return Math.round(res);
    }
  } catch (e) {
    return null;
  }

  return null;
}

/**
 * Processes an incoming message in a dedicated counting channel
 * @param {import('discord.js').Message} message 
 * @param {object} config 
 */
export async function handleCountingMessage(message, config) {
  if (!message.guild || message.author.bot || message.system) return;

  const content = message.content.trim();
  const parsedNum = evaluateCountInput(content, config.allowMath !== false);
  const currentCount = config.currentCount || 0;
  const target = currentCount + 1;

  // 1. Non-numeric chat message in counting channel
  if (parsedNum === null) {
    await message.delete().catch(() => null);
    const warnMsg = await message.channel.send({
      content: `-# ${EMOJI_WARN} ${message.author} **Only numbers are allowed in this channel!** The next number is **${target}**.`
    }).catch(() => null);
    if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => null), 4000);
    return;
  }

  // 2. Turn-taking violation: User counted twice in a row
  if (config.lastUserId === message.author.id) {
    if (config.saves > 0) {
      config.saves--;
      db.updateCounting(message.guild.id, { saves: config.saves });
      await message.react(ID_WARN).catch(() => null);
      const warnMsg = await message.reply({
        content: `-# ${EMOJI_WARN} ${message.author} **You cannot count twice in a row!** A server save was consumed (**${config.saves}** remaining). Next number is still **${target}**!`
      }).catch(() => null);
      if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => null), 6000);
      return;
    }

    // RUINED
    await message.react(EMOJI_WRONG).catch(() => message.react(ID_WRONG)).catch(() => null);
    const finalCount = currentCount;
    const highScore = Math.max(config.highScore || 0, finalCount);
    
    // Update DB
    config.currentCount = 0;
    config.highScore = highScore;
    config.lastUserId = null;
    config.lastMessageId = null;
    if (!config.users) config.users = {};
    if (!config.users[message.author.id]) config.users[message.author.id] = { count: 0, ruins: 0 };
    config.users[message.author.id].ruins = (config.users[message.author.id].ruins || 0) + 1;
    db.updateCounting(message.guild.id, config);

    const ruinContainer = {
      type: 17,
      components: [
        { type: 10, content: `## Count Ruined! | ${EMOJI_WRONG}` },
        { type: 14, divider: true },
        { type: 10, content: `-# **${message.author}** ruined the count at **${finalCount}** by counting twice in a row!\n-# All-Time Record: **${highScore}**\n-# The count resets back to **1**!` },
        { type: 14, divider: true },
        { type: 10, content: `-# **Start again by typing \`1\` below.**` }
      ]
    };
    await message.channel.send({ components: [ruinContainer], flags: 32768 });
    return;
  }

  // 3. Wrong number typed
  if (parsedNum !== target) {
    if (config.saves > 0) {
      config.saves--;
      db.updateCounting(message.guild.id, { saves: config.saves });
      await message.react(ID_WARN).catch(() => null);
      const warnMsg = await message.reply({
        content: `-# ${EMOJI_WARN} ${message.author} typed **${parsedNum}**, but the next number was **${target}**! A server save was consumed (**${config.saves}** remaining). Next number is still **${target}**!`
      }).catch(() => null);
      if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => null), 6000);
      return;
    }

    // RUINED
    await message.react(EMOJI_WRONG).catch(() => message.react(ID_WRONG)).catch(() => null);
    const finalCount = currentCount;
    const highScore = Math.max(config.highScore || 0, finalCount);

    config.currentCount = 0;
    config.highScore = highScore;
    config.lastUserId = null;
    config.lastMessageId = null;
    if (!config.users) config.users = {};
    if (!config.users[message.author.id]) config.users[message.author.id] = { count: 0, ruins: 0 };
    config.users[message.author.id].ruins = (config.users[message.author.id].ruins || 0) + 1;
    db.updateCounting(message.guild.id, config);

    const ruinContainer = {
      type: 17,
      components: [
        { type: 10, content: `## Count Ruined! | ${EMOJI_WRONG}` },
        { type: 14, divider: true },
        { type: 10, content: `-# **${message.author}** ruined the count at **${finalCount}**! (Typed \`${parsedNum}\`, expected \`${target}\`)\n-# All-Time Record: **${highScore}**\n-# The count resets back to **1**!` },
        { type: 14, divider: true },
        { type: 10, content: `-# **Start again by typing \`1\` below.**` }
      ]
    };
    await message.channel.send({ components: [ruinContainer], flags: 32768 });
    return;
  }

  // 4. Correct number!
  await message.react(EMOJI_TICK).catch(() => message.react(ID_TICK)).catch(() => null);
  config.currentCount = parsedNum;
  config.lastUserId = message.author.id;
  config.lastMessageId = message.id;

  const isNewRecord = parsedNum > (config.highScore || 0);
  if (isNewRecord) {
    config.highScore = parsedNum;
  }

  // User stats tracking
  if (!config.users) config.users = {};
  if (!config.users[message.author.id]) config.users[message.author.id] = { count: 0, ruins: 0 };
  config.users[message.author.id].count = (config.users[message.author.id].count || 0) + 1;

  // Reward +1 save every 100 counts (max 5)
  if (parsedNum % 100 === 0 && config.saves < (config.maxSaves || 5)) {
    config.saves = (config.saves || 0) + 1;
  }

  db.updateCounting(message.guild.id, config);

  // Milestone Celebration
  if (parsedNum % 100 === 0 || (isNewRecord && parsedNum % 50 === 0)) {
    const cheerContainer = {
      type: 17,
      components: [
        { type: 10, content: `## Milestone Reached! | ${EMOJI_TICK}` },
        { type: 14, divider: true },
        { type: 10, content: `-# The server just reached **${parsedNum}**! ${isNewRecord ? '**New All-Time Server Record!**' : ''}\n-# Next number is **${parsedNum + 1}**!` }
      ]
    };
    await message.channel.send({ components: [cheerContainer], flags: 32768 }).catch(() => null);
  }

  // Auto-Topic update every 20 counts (throttled to avoid Discord rate limits)
  if (config.autoTopic !== false && parsedNum % 20 === 0) {
    message.channel.setTopic(`Next count: ${parsedNum + 1} | All-Time Record: ${config.highScore} | Last counted by: ${message.author.username}`).catch(() => null);
  }
}
