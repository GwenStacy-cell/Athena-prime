import fs from "fs";

let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

const startStr = "// 0. AUTO-MODERATION: MASS MENTION SPAM";
const endStr = "// 3.5. AUTO-RESPONDER TRIGGERS";

const startIdx = text.indexOf(startStr);
const endIdx = text.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `// AUTOMATED MODERATION & SECURITY MATRIX
      // ==========================================
      const isBotOwner = isBotOwnerSync(message.author.id);
      const isExtraOwner = db.isExtraOwner(message.guild.id, message.author.id);
      const isServerOwner = message.author.id === message.guild.ownerId;
      const isAdmin = message.member.permissions.has(PermissionFlagsBits.ManageMessages);
      
      const checkBypass = (filterName, hasImmunity = false) => {
        if (isBotOwner || isExtraOwner || isServerOwner || isAdmin || hasImmunity) return true;
        const bypasses = dbConfig.automodBypasses || {};
        const memberRoles = message.member.roles.cache;
        
        for (const [roleId, allowedFilters] of Object.entries(bypasses)) {
          if (memberRoles.has(roleId) && allowedFilters.includes(filterName)) {
            return true;
          }
        }
        return false;
      };

      const maxWarnings = dbConfig.maxWarnings || 3;
      
      const applyWarning = async (reason, publicAlert, alertTitle) => {
          const warns = db.addWarning(guildId, userId, message.client.user.id, reason);
          logToSecurityChannel(message.guild, cv2.log(
            alertTitle,
            reason,
            [
              { name: 'Member', value: \`\${message.author.tag} (\${userId})\`, inline: true },
              { name: 'Channel', value: \`\${message.channel}\`, inline: true },
              { name: 'Warn Increment', value: \`\\\`\${warns.length}\\\` / \${maxWarnings}\` }
            ],
            'warning'
          ));
          if (warns.length >= maxWarnings) {
            const qRes = await executeQuarantine(message.guild, message.member, message.guild.members.me, \`Automated: \${alertTitle} limit reached\`);
            db.clearWarnings(guildId, userId);
            await message.channel.send(cv2.danger('Security Lock Triggered', \`**\${message.author.tag}** has been automatically quarantined.\\n\\n\${qRes.message || ''}\`)).catch(() => null);
          } else if (publicAlert) {
            await message.channel.send(cv2.warn('<:gun:1533859911631376496> ' + alertTitle, \`\${message.author}, \${publicAlert}\\n\\n**Warning Count:** \\\`\${warns.length}\\\` / \${maxWarnings}\`)).catch(() => null);
          }
      };

      // 0. MASS MENTION SPAM
      if (dbConfig.antiSpamMentionEnabled === true && !checkBypass('Mass Mentions')) {
         const mentions = message.mentions.users;
         if (mentions.size > 0) {
             let timeoutTriggered = false;
             for (const [targetId, user] of mentions) {
                 if (targetId === message.author.id || user.bot) continue;
                 const cacheKey = \`\${message.guild.id}_\${message.author.id}_\${targetId}\`;
                 const now = Date.now();
                 let data = massMentionCache.get(cacheKey) || { count: 0, timestamp: now };
                 if (now - data.timestamp > 10000) data = { count: 0, timestamp: now };
                 data.count++;
                 data.timestamp = now;
                 massMentionCache.set(cacheKey, data);
                 
                 if (data.count >= 3 && !timeoutTriggered) {
                     timeoutTriggered = true;
                     await message.delete().catch(() => null);
                     await message.member.timeout(5 * 60 * 1000, "Automated: Mass Mention Spam Filter").catch(() => null);
                     await applyWarning(\`User spam pinged \${user.tag} multiple times.\`, \`Mass Mention Filter triggered. You have been timed out for 5 minutes.\`, 'Mass Mention Filter');
                     massMentionCache.delete(cacheKey);
                     return;
                 }
             }
         }
      }

      // 1. ANTI-INVITE
      const isGlobalInviteAllowed = dbConfig.allowInvitesGlobally === true;
      const isInviteAllowedChannel = dbConfig.inviteAllowedChannel === message.channel.id;
      
      if (!isGlobalInviteAllowed && !isInviteAllowedChannel && (dbConfig.antiInviteEnabled || config.antiInvite.enabled) && !checkBypass('Anti Invite', hasAntiInviteImmunity)) {
        const inviteRegex = /(discord\\.(gg|io|me|li)\\/|discord(app)?\\.com\\/invite\\/)/gi;
        if (inviteRegex.test(message.content)) {
          await message.delete().catch(() => null);
          await applyWarning(\`Deleted invite promotion from member.\`, \`posting invites is strictly forbidden.\`, 'Invite Link Filtered');
          return;
        }
      }

      // 1.5 ANTI-LINK (URL FILTER)
      if (dbConfig.allowAllLinks !== true && dbConfig.antiLinkEnabled && !checkBypass('URL Filter', hasAntiLinkImmunity)) {
        const linkRegex = /https?:\\/\\/[^\\s]+/gi;
        if (linkRegex.test(message.content)) {
          await message.delete().catch(() => null);
          await applyWarning(\`Deleted message containing a URL.\`, \`posting links is not allowed.\`, 'URL Filtered');
          return;
        }
      }

      // 1.6 HIDDEN URL FILTER
      if (!checkBypass('Hidden URL Filter')) {
        const mdLinkRegex = /\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\)]+)\\)/gi;
        let match;
        while ((match = mdLinkRegex.exec(message.content)) !== null) {
          const textPart = match[1].toLowerCase();
          const urlPart = match[2].toLowerCase();
          if (/(https?:\\/\\/|[a-z0-9]+\\.(com|net|org|gg|io|info))/.test(textPart)) {
            const textDomainMatch = textPart.match(/([a-z0-9-]+\\.[a-z]+)/);
            if (textDomainMatch && !urlPart.includes(textDomainMatch[1])) {
               await message.delete().catch(() => null);
               await applyWarning(\`Deceptive/Hidden hyperlink markdown detected.\`, \`deceptive links are strictly forbidden!\`, 'Hidden URL Filter');
               return;
            }
          }
        }
      }

      // 1.7 FILE CHECK
      if (!checkBypass('File Check')) {
         if (message.attachments.size > 0) {
            const forbiddenExts = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.zip', '.rar', '.tar', '.gz'];
            for (const [id, attachment] of message.attachments) {
               const ext = attachment.name.toLowerCase().slice(attachment.name.lastIndexOf('.'));
               if (forbiddenExts.includes(ext)) {
                  await message.delete().catch(() => null);
                  await applyWarning(\`Uploaded a forbidden file extension: \${attachment.name}\`, \`uploading executable or compressed files is blocked for security.\`, 'File Check Filter');
                  return;
               }
            }
         }
      }

      // 2. WORD BLACKLIST FILTER
      if (!checkBypass('Swear Words', hasAntiSpamImmunity)) {
        if (dbConfig.wordFilterEnabled !== false && dbConfig.blacklistWords && dbConfig.blacklistWords.length > 0) {
          const msgLower = message.content.toLowerCase();
          const matchedWords = dbConfig.blacklistWords.filter(word => {
            const escapedWord = word.replace(/[.*+?^$!()|[\\]\\\\]/g, '\\\\$&');
            return new RegExp(\`(?:^|\\\\W)\${escapedWord}(?:$|\\\\W)\`, 'i').test(msgLower);
          });
          if (matchedWords.length > 0) {
            await message.delete().catch(() => null);
            await applyWarning(\`Matched blacklisted phrase(s): \${matchedWords.join(', ')}\`, \`please refrain from using blacklisted words.\`, 'Word Filter');
            return;
          }
        }
      }
      
      // 2.5 BIG FONTS
      if (dbConfig.bigFontsEnabled !== false && !checkBypass('Big Fonts')) {
         const letters = message.content.replace(/[^a-zA-Z]/g, '');
         if (letters.length > 10) {
            const upperCount = letters.replace(/[^A-Z]/g, '').length;
            if (upperCount / letters.length > 0.8) {
               await message.delete().catch(() => null);
               await applyWarning(\`Excessive uppercase usage (Big Fonts)\`, \`please turn off caps lock!\`, 'Big Fonts Filter');
               return;
            }
         }
      }

      // 3. ANTI-SPAM & ANTI FLOOD
      if (config.antiSpam.enabled && (dbConfig.antiSpamEnabled !== false || dbConfig.antiFloodEnabled !== false) && !checkBypass('Spam Filter', hasAntiSpamImmunity) && !checkBypass('Anti Flood', hasAntiSpamImmunity)) {
        const now = Date.now();
        if (!spamCache.has(cacheKey)) spamCache.set(cacheKey, []);
        const timestamps = spamCache.get(cacheKey);
        const cleanTimestamps = timestamps.filter(time => now - time < config.antiSpam.intervalMs);
        cleanTimestamps.push(now);
        spamCache.set(cacheKey, cleanTimestamps);
  
        if (cleanTimestamps.length > config.antiSpam.maxMessages) {
          const lastCooldown = spamCooldown.get(cacheKey) || 0;
          if (now - lastCooldown > 5000) {
            spamCooldown.set(cacheKey, now);
            spamCache.set(cacheKey, []); 
            try {
              const fetched = await message.channel.messages.fetch({ limit: 15 });
              const userSpam = fetched.filter(m => m.author.id === userId && now - m.createdTimestamp < 4000);
              await message.channel.bulkDelete(userSpam).catch(() => null);
            } catch (e) {
              await message.delete().catch(() => null);
            }
            await applyWarning(\`User triggered rate-limits by exceeding message counts.\`, \`please slow down. Sending messages too fast is against server security rules.\`, 'Spam / Flood Detected');
          }
          return;
        }
      }

      // ==========================================
      `;

    text = text.substring(0, startIdx) + replacement + text.substring(endIdx);
    fs.writeFileSync("src/events/messageCreate.js", text);
    console.log("Replacement successful.");
} else {
    console.log("Start or end index not found.");
}
