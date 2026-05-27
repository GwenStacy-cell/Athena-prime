import { PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import db from '../database.js';
import embed from '../embed.js';
import commandMap from '../commands/loader.js';
import { executeQuarantine } from '../commands/security.js';
import { canModerate, logToSecurityChannel } from '../utils/helpers.js';

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
    if (!message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const cacheKey = `${guildId}-${userId}`;

    // Load server configurations
    const dbConfig = db.getGuildConfig(guildId);

    // Whitelisted users and owner are immune to all auto-moderation filters
    const isImmune = db.isWhitelisted(message.guild, userId);

    // ==========================================
    // 1. AUTO-MODERATION: ANTI-INVITE
    // ==========================================
    const antiInviteActive = dbConfig.antiInviteEnabled !== undefined ? dbConfig.antiInviteEnabled : config.antiInvite.enabled;
    if (!isImmune && antiInviteActive && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
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
    // 2. AUTO-MODERATION: WORD BLACKLIST FILTER
    // ==========================================
    if (!isImmune && dbConfig.blacklistWords && dbConfig.blacklistWords.length > 0 && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const lowerContent = message.content.toLowerCase();
      const matchedWord = dbConfig.blacklistWords.find(word => lowerContent.includes(word));
      
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
    if (!isImmune && config.antiSpam.enabled && dbConfig.antiSpamEnabled && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
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
    // 3. COMMAND ENGINE (PREFIX PARSER)
    // ==========================================
    const prefix = dbConfig.prefix;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const cmd = commandMap.get(commandName);
    if (!cmd) return;

    // Verify moderator permissions
    if (cmd.permissions && cmd.permissions.length > 0) {
      const hasPerms = cmd.permissions.every(perm => message.member.permissions.has(perm));
      if (!hasPerms) {
        const errorEmbed = embed.danger(
          'Access Denied',
          '🛡️ You do not possess the required permissions to execute this security command.'
        );
        return message.reply({ embeds: [errorEmbed] });
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
