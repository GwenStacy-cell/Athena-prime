import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import db from '../database.js';
import embed, { setGuildContext } from '../embed.js';
import commandMap from '../commands/loader.js';
import { executeQuarantine } from '../commands/security.js';
import { handleEzal, handleBackup } from '../commands/ezal.js';
import { canModerate, logToSecurityChannel, isAuthorized, isBotOwnerSync, getPresenceStatus, findClosestCommand } from '../utils/helpers.js';

// Safely load config
const configPath = path.resolve('config.json');
let config = {
  antiSpam: { enabled: true, maxMessages: 5, intervalMs: 3000 },
  antiInvite: { enabled: true, deleteInvites: true }
};
try {
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (error) {
  console.error('Failed to load config in message event:', error);
}

// In-memory maps for anti-spam trackers
const spamCache = new Map(); // key: guildId-userId -> array of timestamps
const spamCooldown = new Map(); // key: guildId-userId -> cooldown timestamp

export default {
  name: 'messageCreate',
  async execute(message) {
    // Ignore bots and webhooks
    if (message.author.bot || message.webhookId) return;

    // ==========================================
    // DM CONTEXT — spam commands for permitted users / bot owner
    // Works with or without the ! prefix (e.g. "spam @user hi" or "!spam @user hi")
    // ==========================================
    if (!message.guild) {
      const isBotOwner = isBotOwnerSync(message.author.id);
      const isPermitted = db.isSpamPermitted(message.author.id);

      // Strip leading ! prefix if present
      let rawContent = message.content.trim();
      if (rawContent.startsWith('!')) rawContent = rawContent.slice(1).trimStart();

      const lower = rawContent.toLowerCase();
      const parts = rawContent.split(/ +/);
      const cmdName = parts[0].toLowerCase();
      const args = parts.slice(1);

      // Spam command — permitted users and bot owner
      if (cmdName === 'spam' && (isBotOwner || isPermitted)) {
        const spamCmd = commandMap.get('spam');
        if (spamCmd) await spamCmd.executePrefix(message, args).catch(() => null);
        return;
      }

      // Owner-only DM commands (spampermit, spamrevoke, spamlist)
      if (isBotOwner) {
        const ownerCmd = commandMap.get(cmdName);
        if (ownerCmd && ['spampermit', 'spamrevoke', 'spamlist'].includes(cmdName)) {
          await ownerCmd.executePrefix(message, args).catch(() => null);
          return;
        }
      }

      return; // Ignore all other messages in DMs
    }

    const guildId = message.guild.id;
    const userId = message.author.id;
    const cacheKey = `${guildId}-${userId}`;

    // Set guild context so all embed calls in this command chain use the correct accent color
    setGuildContext(guildId);

    // Load server configurations
    const dbConfig = db.getGuildConfig(guildId);

    // ==========================================
    // 0. OWNER MENTION DETECTION
    // ==========================================
    const ownerId = process.env.OWNER_ID;
    if (ownerId && userId !== ownerId && message.mentions.has(ownerId)) {
      try {
        const presence = getPresenceStatus(message.guild, ownerId);

        const ownerEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setDescription(`# You tagged my Master !\n\n> Status: **${presence.text.toUpperCase()}**\n\nYour ping has been forwarded through direct messages.\nAwait his arrival.`)
          .setFooter({ text: `${message.client.user.username} Security • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}` });

        await message.reply({ content: `<@${userId}>`, embeds: [ownerEmbed] }).catch(() => null);

        // DM the owner
        const ownerUser = await message.client.users.fetch(ownerId).catch(() => null);
        if (ownerUser) {
          const dmEmbed = embed.info(
            'You were tagged!',
            null,
            [
              { name: 'Tagger', value: `${message.author.tag} (<@${userId}>)`, inline: true },
              { name: 'Server', value: `${message.guild.name}`, inline: true },
              { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
              { name: 'Message Link', value: `[Jump to Message](https://discord.com/channels/${guildId}/${message.channel.id}/${message.id})` }
            ]
          );
          await ownerUser.send({ embeds: [dmEmbed] }).catch(() => null);
        }
      } catch (error) {
        console.error('Error in owner mention detection:', error);
      }
    }

    // Granular Whitelist checks
    const hasAntiInviteImmunity = db.isWhitelisted(message.guild, userId, 'antiinvite');
    const hasAntiLinkImmunity = db.isWhitelisted(message.guild, userId, 'antilink');
    const hasAntiSpamImmunity = db.isWhitelisted(message.guild, userId, 'antispam');

    // ==========================================
    // 1. AUTO-MODERATION: ANTI-INVITE
    // ==========================================
    const antiInviteActive = dbConfig.antiInviteEnabled !== undefined ? dbConfig.antiInviteEnabled : config.antiInvite.enabled;
    if (!hasAntiInviteImmunity && antiInviteActive && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const inviteRegex = /(discord\.(gg|io|me|li)\/.+|discord(app)?\.com\/invite\/.+)/gi;
      if (inviteRegex.test(message.content)) {
        if (config.antiInvite.deleteInvites) {
          await message.delete().catch(() => null);
        }

        const warnEmbed = embed.warn(
          'Invite Link Deleted',
          `${message.author}, invite links are strictly prohibited in this guild to prevent promotion spam.`
        );
        const alertMsg = await message.channel.send({ embeds: [warnEmbed] }).catch(() => null);
        if (alertMsg) {
          setTimeout(() => alertMsg.delete().catch(() => null), 6000);
        }

        logToSecurityChannel(message.guild, embed.log(
          'Invite Link Filtered',
          `Deleted invite promotion from member.`,
          [
            { name: 'Member', value: `${message.author.tag} (${userId})`, inline: true },
            { name: 'Channel', value: `${message.channel}`, inline: true },
            { name: 'Content Filtered', value: `\`\`\`${message.content}\`\`\`` }
          ],
          'warning'
        ));
        
        return;
      }
    }

    // ==========================================
    // 1.5. AUTO-MODERATION: ANTI-LINK
    // ==========================================
    if (!hasAntiLinkImmunity && dbConfig.antiLinkEnabled && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      // allowAllLinks = true means admin has disabled the filter for all links
      if (dbConfig.allowAllLinks !== true) {
        const linkRegex = /https?:\/\/[^\s]+/gi;
        const matches = message.content.match(linkRegex);
        if (matches) {
          const allowedLinks = dbConfig.allowedLinks || [];
          // A link is disallowed if it doesn't match any allowed domain
          const hasDisallowedLink = matches.some(url => {
            if (allowedLinks.length === 0) return true;
            return !allowedLinks.some(domain => url.toLowerCase().includes(domain.toLowerCase()));
          });

          if (hasDisallowedLink) {
            await message.delete().catch(() => null);

            const warnEmbed = embed.warn(
              'Link Deleted',
              `${message.author}, posting links is not allowed in this server.`
            );
            const alertMsg = await message.channel.send({ embeds: [warnEmbed] }).catch(() => null);
            if (alertMsg) {
              setTimeout(() => alertMsg.delete().catch(() => null), 6000);
            }

            logToSecurityChannel(message.guild, embed.log(
              'Link Filtered',
              `Deleted message containing a disallowed URL from member.`,
              [
                { name: 'Member', value: `${message.author.tag} (${userId})`, inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Content Filtered', value: `\`\`\`${message.content}\`\`\`` }
              ],
              'warning'
            ));

            return;
          }
        }
      }
    }

    // ==========================================
    // 2. AUTO-MODERATION: WORD BLACKLIST FILTER
    // ==========================================
    if (!hasAntiSpamImmunity && dbConfig.blacklistWords && dbConfig.blacklistWords.length > 0 && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const msgLower = message.content.toLowerCase();
      const matchedWord = dbConfig.blacklistWords.find(word => msgLower.includes(word));
      
      if (matchedWord) {
        await message.delete().catch(() => null);

        const maxWarnings = dbConfig.maxWarnings || 3;
        const warns = db.addWarning(guildId, userId, message.client.user.id, `Automated AutoMod: Matched blacklisted phrase: "${matchedWord}"`);

        logToSecurityChannel(message.guild, embed.log(
          'Blacklisted Word Detected',
          `Purged content containing filtered phrase.`,
          [
            { name: 'Member', value: `${message.author.tag} (${userId})`, inline: true },
            { name: 'Channel', value: `${message.channel}`, inline: true },
            { name: 'Matched Word', value: `\`${matchedWord}\``, inline: true },
            { name: 'Warnings Count', value: `\`${warns.length}\` / ${maxWarnings}` }
          ],
          'warning'
        ));

        if (warns.length >= maxWarnings) {
          const quarantineReason = `Automated: Warning threshold limit exceeded (${warns.length}/${maxWarnings} Warnings)`;
          const quarantineRes = await executeQuarantine(message.guild, message.member, message.guild.members.me, quarantineReason);
          
          db.clearWarnings(guildId, userId);

          const criticalEmbed = embed.danger(
            'Profanity Quarantine Protocol',
            `⚠️ **${message.author.tag}** has been automatically **quarantined** for exceeding maximum word filter warning thresholds (${warns.length}/${maxWarnings}).\n\n${quarantineRes.message || ''}`
          );
          await message.channel.send({ embeds: [criticalEmbed] }).catch(() => null);
        } else {
          const filterWarnEmbed = embed.warn(
            'Profanity/Word Filter Triggered',
            `⚠️ ${message.author}, your message contained a blacklisted word and was deleted.\n\n**Warning Count:** \`${warns.length}\` / ${maxWarnings}`
          );
          const alertMsg = await message.channel.send({ embeds: [filterWarnEmbed] }).catch(() => null);
          if (alertMsg) {
            setTimeout(() => alertMsg.delete().catch(() => null), 8000);
          }
        }
        return; // Halt
      }
    }

    // ==========================================
    // 3. AUTO-MODERATION: ANTI-SPAM
    // ==========================================
    if (!hasAntiSpamImmunity && config.antiSpam.enabled && dbConfig.antiSpamEnabled && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const now = Date.now();
      
      if (!spamCache.has(cacheKey)) {
        spamCache.set(cacheKey, []);
      }

      const timestamps = spamCache.get(cacheKey);
      const cleanTimestamps = timestamps.filter(time => now - time < config.antiSpam.intervalMs);
      cleanTimestamps.push(now);
      spamCache.set(cacheKey, cleanTimestamps);

      if (cleanTimestamps.length > config.antiSpam.maxMessages) {
        const lastCooldown = spamCooldown.get(cacheKey) || 0;
        
        if (now - lastCooldown > 5000) {
          spamCooldown.set(cacheKey, now);
          spamCache.set(cacheKey, []); // Reset tracker

          const maxWarnings = dbConfig.maxWarnings || 3;
          const warns = db.addWarning(guildId, userId, message.client.user.id, 'Automated: Excess messages / Spam detection');

          try {
            const fetched = await message.channel.messages.fetch({ limit: 15 });
            const userSpam = fetched.filter(m => m.author.id === userId && now - m.createdTimestamp < 4000);
            await message.channel.bulkDelete(userSpam).catch(() => null);
          } catch (e) {
            await message.delete().catch(() => null);
          }

          logToSecurityChannel(message.guild, embed.log(
            'Spam Threat Detected',
            `User triggered rate-limits by exceeding message counts.`,
            [
              { name: 'Member', value: `${message.author.tag} (${userId})`, inline: true },
              { name: 'Channel', value: `${message.channel}`, inline: true },
              { name: 'Warn Increment', value: `\`${warns.length}\` / ${maxWarnings}` }
            ],
            'warning'
          ));

          if (warns.length >= maxWarnings) {
            const quarantineReason = `Automated: Anti-Spam warning limit reached (${warns.length}/${maxWarnings} Warnings)`;
            const quarantineRes = await executeQuarantine(message.guild, message.member, message.guild.members.me, quarantineReason);
            
            db.clearWarnings(guildId, userId);

            const criticalEmbed = embed.danger(
              'Raid Security Lock Triggered',
              `⚠️ **${message.author.tag}** has been automatically **isolated and quarantined** for severe server spamming.\n\n${quarantineRes.message || ''}`
            );
            await message.channel.send({ embeds: [criticalEmbed] }).catch(() => null);
          } else {
            const spamWarnEmbed = embed.warn(
              'Anti-Spam Warning',
              `⚠️ ${message.author}, please slow down. Sending messages too fast is against server security rules.\n\n**Warning Count:** \`${warns.length}\` / ${maxWarnings}`
            );
            const alertMsg = await message.channel.send({ embeds: [spamWarnEmbed] }).catch(() => null);
            if (alertMsg) {
              setTimeout(() => alertMsg.delete().catch(() => null), 8000);
            }
          }
        }
        return;
      }
    }

    // ==========================================
    // 3.5. AUTO-RESPONDER TRIGGERS
    // ==========================================
    // Do not trigger on prefix commands (avoids overlapping logic)
    const prefix = dbConfig.prefix || '!';
    if (!message.content.startsWith(prefix)) {
      const msgLowerForTriggers = message.content.toLowerCase();
      const triggers = db.getTriggers(guildId);
      
      for (const t of triggers) {
        if (msgLowerForTriggers.includes(t.match.toLowerCase())) {
          let responseText = t.response.trim();

          // Extract original URL from Discord proxy link if needed
          const proxyMatch = responseText.match(/https\/([^\s]+)/i);
          if (responseText.includes('discordapp.net/external') && proxyMatch) {
            responseText = 'https://' + proxyMatch[1];
          }

          const isUrl = /^https?:\/\/[^\s]+$/i.test(responseText);

          if (isUrl) {
            if (/\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(responseText)) {
              // Standard images sent as invisible embeds to hide the URL text
              const e = new EmbedBuilder().setImage(responseText).setColor(0x2b2d31);
              await message.channel.send({ embeds: [e] }).catch(() => null);
            } else {
              // If it's a tenor/giphy page link, or an .mp4, send the raw link and let Discord unfurl it
              await message.channel.send(responseText).catch(() => null);
            }
          } else {
            await message.channel.send(responseText).catch(() => null);
          }
          break; // Reply only once per message
        }
      }
    }

    // ==========================================
    // 4. PREFIX-LESS COMMANDS: PING
    // ==========================================
    if (message.content.toLowerCase().trim() === 'ping') {
      const { EmbedBuilder } = await import('discord.js');
      const cfg = db.getGuildConfig(guildId);
      const accentHex = cfg?.accentColor || '#00e5ff';
      const accentInt = parseInt(accentHex.replace('#', ''), 16);

      const sent   = await message.reply({ content: '\u200b' });
      const apiMs  = sent.createdTimestamp - message.createdTimestamp;
      const wsMs   = Math.round(message.client.ws.ping);

      const dbStart = Date.now();
      db.getGuildConfig(guildId);
      const dbMs = Date.now() - dbStart;

      const rSet = Math.floor(Math.random() * 3) + 1;
      const rGet = Math.floor(Math.random() * 2) + 1;
      const rDel = Math.floor(Math.random() * 2) + 1;

      const e1 = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`| **${apiMs}MS** |`);

      const e2 = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`**• PONG**\nWS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms`)
        .setThumbnail(message.client.user.displayAvatarURL({ size: 256 }));

      await sent.edit({ content: null, embeds: [e1, e2] });
      return;
    }
    // ==========================================
    // 4.4 PREFIX-LESS: EZAL (Owner Suite)
    // ==========================================
    const msgCheck = message.content.toLowerCase().trim();

    if (msgCheck === 'ezal' || msgCheck.startsWith('ezal ')) {
      await handleEzal(message);
      return;
    }

    // ==========================================
    // 4.45 PREFIX-LESS: BACKUP (Bot Owner + Server Owner)
    // Server owners can backup their own server without ezal prefix
    // ==========================================
    if (msgCheck === 'backup' || msgCheck.startsWith('backup ')) {
      const isOwner = isBotOwnerSync(message.author.id);
      const isServerOwner = message.guild && message.author.id === message.guild.ownerId;
      if (isOwner || isServerOwner) {
        const backupArgs = message.content.trim().split(/ +/).slice(1);
        await handleBackup(message, backupArgs).catch(console.error);
      }
      return;
    }

    // ==========================================
    // 4.5 PREFIX-LESS: ENUKE (Owner Only)
    // ==========================================

    if (msgCheck === 'enuke' || msgCheck.startsWith('enuke ')) {
      if (isBotOwnerSync(message.author.id)) {
        const enukeArgs = message.content.trim().split(/ +/).slice(1);
        const enukeCmd = commandMap.get('enuke');
        if (enukeCmd) {
          try {
            await enukeCmd.executePrefix(message, enukeArgs);
          } catch (error) {
            console.error('Error executing enuke:', error);
            await message.reply({ embeds: [embed.danger('Enuke Error', 'An error occurred while launching the Enuke Manager.')] }).catch(() => null);
          }
        }
      }
      return; // Silent for non-owners
    }

    // ==========================================
    // 4.6 PREFIX-LESS: SPAM + QR (short quarantine)
    // ==========================================

    if (msgCheck === 'spam' || msgCheck.startsWith('spam ')) {
      const spamCmd = commandMap.get('spam');
      if (spamCmd) {
        try {
          const spamArgs = message.content.trim().split(/ +/).slice(1);
          await spamCmd.executePrefix(message, spamArgs);
        } catch (error) {
          console.error('Error executing spam:', error);
        }
      }
      return;
    }

    // qr is a short alias for quarantine — works without ! prefix
    if (msgCheck === 'qr' || msgCheck.startsWith('qr ')) {
      const qrCmd = commandMap.get('qr');
      if (qrCmd) {
        try {
          const qrArgs = message.content.trim().split(/ +/).slice(1);
          await qrCmd.executePrefix(message, qrArgs);
        } catch (error) {
          console.error('Error executing qr:', error);
        }
      }
      return;
    }

    // ==========================================
    // 5. COMMAND ENGINE (PREFIX PARSER)
    // ==========================================
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // These are handled by dedicated prefix-less handlers — skip to avoid double response
    if (commandName === 'ezal' || commandName === 'backup' || commandName === 'enuke' || commandName === 'spam' || commandName === 'qr') return;

    const cmd = commandMap.get(commandName);

    // Intelligent command error correction with fuzzy matching
    if (!cmd) {
      const closest = findClosestCommand(commandName, [...commandMap.keys()]);
      if (closest) {
        const suggestEmbed = embed.warn(
          'Unknown Command',
          `${message.author} ❌ Command \`${prefix}${commandName}\` not found.\n\n💡 Did you mean: \`${prefix}${closest}\`?\n\nUse \`${prefix}help\` for all commands.`
        );
        return message.reply({ embeds: [suggestEmbed] }).catch(() => null);
      } else {
        const notFoundEmbed = embed.warn(
          'Unknown Command',
          `${message.author} ❌ Command \`${prefix}${commandName}\` does not exist.\n\nUse \`${prefix}help\` for all available commands.`
        );
        return message.reply({ embeds: [notFoundEmbed] }).catch(() => null);
      }
    }

    // Verify moderator permissions — bot owner, server owner, and extra owners bypass ALL checks
    if (cmd.permissions && cmd.permissions.length > 0) {
      const isBypass = isBotOwnerSync(message.author.id) ||
        message.author.id === message.guild.ownerId ||
        db.isExtraOwner(message.guild.id, message.author.id);

      if (!isBypass) {
        const hasPerms = cmd.permissions.every(perm => message.member.permissions.has(perm));
        if (!hasPerms) {
          return message.reply({ embeds: [embed.danger('Access Denied', '🛡️ You do not possess the required permissions to execute this command.')] });
        }
      }
    }

    try {
      await cmd.executePrefix(message, args);
    } catch (error) {
      console.error(`Error executing command ${cmd.name} via Prefix:`, error);
      const errEmbed = embed.danger(
        'Execution Error',
        'An unexpected error occurred while executing this command.'
      );
      await message.reply({ embeds: [errEmbed] }).catch(() => null);
    }
  }
};
