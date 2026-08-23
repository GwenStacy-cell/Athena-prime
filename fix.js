import fs from 'fs';
let code = fs.readFileSync('src/events/guildMemberAdd.js', 'utf8');

const oldStr = `    // ==========================================
    // 0. BOT ADD GUARD
    // ==========================================
    if (member.user.bot) {
      // BotAdd is handled with zero-latency via the websocket hook (handleAuditLogEntry)
      // We do NOT proactively strip roles - legitimate bots that haven't been
      // whitelisted yet (MEE6, Dyno, Carl-bot etc.) would break immediately.
      return;
    }`;

const newStr = `    // ==========================================
    // 0. BOT ADD GUARD — 1ms DIRECT STRIKE
    // ==========================================
    if (member.user.bot) {
      if ((config.securityEnabled || config.antiNukeEnabled) && config.antinukeModules?.antiBotAdd) {
        import('../utils/antinuke.js').then(({ isBotAuthorized, rawBan, directStrike }) => {
          if (!isBotAuthorized(guild, member.id)) {
            // ? INSTANT 1ms ELIMINATION
            // We ban the bot instantly without waiting for the audit log!
            rawBan(guild.id, member.id, guild.client.token, '[ATHENA] Anti-Nuke: Unauthorized Bot Addition').catch(() => null);
            
            // Fire directStrike to find the executor (who added the bot) and ban them too
            directStrike(guild, 28 /* AuditLogEvent.BotAdd */, 'Unauthorized Bot Addition', member.id, null).catch(() => null);
          }
        });
      }
      return;
    }`;

// normalize line endings to fix replace
code = code.replace(/\r\n/g, '\n');
code = code.replace(oldStr, newStr);

fs.writeFileSync('src/events/guildMemberAdd.js', code);
