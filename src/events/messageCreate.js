import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import db from '../database.js';
import embed, { setGuildContext } from '../embed.js';
import commandMap from '../commands/loader.js';
import { executeQuarantine } from '../commands/security.js';
import { handleEzal, handleBackup } from '../commands/ezal.js';
import statsDB from '../statsDB.js';
import { canModerate, logToSecurityChannel, isAuthorized, isBotOwnerSync, getPresenceStatus, findClosestCommand } from '../utils/helpers.js';
import { calculateLevel, getRandomXp, getRoleMultiplier, processLevelUp } from '../utils/xpEngine.js';
import { Client } from 'nekos-best.js';

const nbClient = new Client();
const gifCache = new Map();

async function getCachedGif(action) {
  if (!gifCache.has(action)) gifCache.set(action, []);
  const pool = gifCache.get(action);

  if (pool.length === 0) {
    try {
      const res = await nbClient.fetch(action, 20);
      if (res && res.results) pool.push(...res.results.map(r => r.url));
    } catch (err) {
      console.error(`[Roleplay] Pool fetch failed for ${action}:`, err);
    }
  }

  if (pool.length === 0) return null;
  const url = pool.pop();

  if (pool.length < 5) {
    nbClient.fetch(action, 20).then(res => {
      if (res && res.results) pool.push(...res.results.map(r => r.url));
    }).catch(() => null);
  }
  return url;
}

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
const masterPingCooldowns = new Map(); // key: guildId -> timestamp

export default {
  name: 'messageCreate',
  async execute(message) {
    // Disboard Bump Detection
    if (message.author.id === '302050872383242240' && message.embeds.length > 0) {
      const embedDesc = message.embeds[0].description || '';
      if (embedDesc.includes('Bump done!') || embedDesc.includes('Check it out on DISBOARD')) {
        let bumperId = null;
        if (message.interaction && message.interaction.user) {
          bumperId = message.interaction.user.id;
        }
        
        if (message.guild) {
          db.setBumpReminder(message.guild.id, {
            channelId: message.channel.id,
            ownerId: message.guild.ownerId,
            bumperId: bumperId,
            expiresAt: Date.now() + 7200000 // 2 hours
          });
        }
      }
    }

    // Ignore bots and webhooks
    if (message.author.bot || message.webhookId) return;

    // Ignore globally blacklisted users
    if (db.isUserBotBlacklisted(message.author.id)) return;

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
    // XP & LEVELING (TEXT)
    // ==========================================
    const xpSystem = db.getXpSystem(guildId);
    if (xpSystem && xpSystem.enabled && !message.content.startsWith(dbConfig.prefix)) {
      const userXp = db.getUserXp(guildId, userId);
      const now = Date.now();
      
      // 60-second cooldown to prevent spamming XP
      if (now - userXp.lastMessageAt >= 60000) {
        const mult = getRoleMultiplier(guildId, message.member);
        const gained = Math.floor(getRandomXp() * mult);
        
        userXp.xp += gained;
        userXp.lastMessageAt = now;
        
        const newLevel = calculateLevel(userXp.xp);
        if (newLevel > userXp.level) {
          userXp.level = newLevel;
          processLevelUp(message.client, message.guild, message.member, newLevel).catch(() => null);
        }
        
        db.setUserXp(guildId, userId, userXp);
      }
    }

    // ==========================================
    // 0.5. ROLEPLAY / REACTION SYSTEM
    // ==========================================
    // Check if message strictly starts with the bot mention
    const botMentionSpaceRegex = new RegExp(`^<@!?${message.client.user.id}>\\s+`);
    if (botMentionSpaceRegex.test(message.content)) {
      const args = message.content.replace(botMentionSpaceRegex, '').trim().split(/ +/);
      const actionRaw = args[0]?.toLowerCase();
      
      if (actionRaw) {
        // Find if there is a target mention (anywhere in the arguments after the action)
        const targetUser = message.mentions.users.find(u => u.id !== message.client.user.id);

        const actionMap = {
          // Direct matches
          kiss: 'kiss', hug: 'hug', slap: 'slap', punch: 'punch', kick: 'kick',
          bite: 'bite', pat: 'pat', poke: 'poke', sleep: 'sleep', cuddle: 'cuddle',
          angry: 'angry', shake: 'shake', think: 'think', smile: 'smile', laugh: 'laugh',
          happy: 'happy', stare: 'stare', wave: 'wave', wink: 'wink', cry: 'cry',
          tickle: 'tickle', baka: 'baka', yeet: 'yeet', blush: 'blush', bonk: 'bonk',
          dance: 'dance', pout: 'pout', shrug: 'shrug', smug: 'smug', feed: 'feed',
          highfive: 'highfive', handshake: 'handshake', handhold: 'handhold',
          shoot: 'shoot', sip: 'sip', spin: 'spin', tableflip: 'tableflip', yawn: 'yawn', nod: 'nod',
          salute: 'salute', run: 'run',

          // Synonyms & Requested
          lick: 'nom', fuck: 'kabedon', protect: 'cuddle', wiggle: 'dance', move: 'run',
          kill: 'shoot', cringe: 'facepalm', lift: 'carry', roll: 'spin', see: 'stare',
          look: 'stare', greet: 'wave', hi: 'wave', clause: 'stare', pinch: 'tickle',
          bait: 'wink', tease: 'smug', smooch: 'peck', romance: 'handhold', love: 'hug',
          hate: 'slap', hifi: 'highfive', deal: 'handshake', sad: 'cry', count: 'think',
          propose: 'handhold', throw: 'yeet', crush: 'blush', eat: 'nom', secure: 'cuddle',
          lock: 'cuddle', unlock: 'pat', tie: 'cuddle', hold: 'handhold', bye: 'wave', tata: 'wave',
          squeeze: 'hug', gesture: 'wave', pray: 'nod', please: 'pout', tweak: 'poke',
          comb: 'pat', alert: 'shocked', wipe: 'pat', swipe: 'slap', play: 'dance', shy: 'blush',
          marry: 'handhold', bully: 'poke', point: 'poke', walk: 'run', keep: 'cuddle',
          ping: 'poke', call: 'wave', sing: 'dance', movie: 'cuddle', flex: 'smug', fight: 'punch',
          awkward: 'blush', akward: 'blush', bury: 'yeet', drink: 'sip', care: 'pat', kidnap: 'carry',
          rotate: 'spin', revolve: 'spin', swing: 'spin', jiggle: 'shake', chop: 'slap',
          fire: 'shoot', train: 'punch', dress: 'pat', tag: 'poke', bath: 'pat', dump: 'yeet'
        };

        const mappedAction = actionMap[actionRaw];
        
        if (mappedAction) {
          try {
              
              const targetStr = targetUser ? `<@${targetUser.id}>` : null;

              const actionSentences = {
                kiss: targetStr ? `gives ${targetStr} a kiss` : 'blows a kiss',
                hug: targetStr ? `gives ${targetStr} a hug` : 'wants a hug',
                slap: targetStr ? `gives ${targetStr} a slap` : 'is slapping the air',
                punch: targetStr ? `gives ${targetStr} a punch` : 'is punching the air',
                kick: targetStr ? `gives ${targetStr} a kick` : 'is kicking the air',
                lick: targetStr ? `gives ${targetStr} a lick` : 'is licking their lips',
                protect: targetStr ? `protects ${targetStr}` : 'is feeling protective',
                wiggle: targetStr ? `wiggles at ${targetStr}` : 'is wiggling',
                move: targetStr ? `moves towards ${targetStr}` : 'is moving',
                bite: targetStr ? `gives ${targetStr} a bite` : 'is biting the air',
                pat: targetStr ? `gives ${targetStr} a pat` : 'wants a pat',
                kill: targetStr ? `kills ${targetStr}` : 'is out for blood',
                poke: targetStr ? `gives ${targetStr} a poke` : 'is poking around',
                cringe: targetStr ? `cringes at ${targetStr}` : 'is cringing',
                sleep: targetStr ? `sleeps next to ${targetStr}` : 'is sleeping',
                lift: targetStr ? `lifts ${targetStr} up` : 'is lifting weights',
                roll: targetStr ? `rolls around with ${targetStr}` : 'is rolling around',
                cuddle: targetStr ? `cuddles with ${targetStr}` : 'wants to cuddle',
                see: targetStr ? `looks at ${targetStr}` : 'is looking around',
                look: targetStr ? `stares at ${targetStr}` : 'is staring',
                greet: targetStr ? `greets ${targetStr}` : 'is waving hello',
                angry: targetStr ? `is angry at ${targetStr}` : 'is angry',
                shake: targetStr ? `shakes ${targetStr}` : 'is shaking',
                clause: targetStr ? `stares closely at ${targetStr}` : 'is staring closely',
                think: targetStr ? `thinks about ${targetStr}` : 'is thinking',
                pinch: targetStr ? `gives ${targetStr} a pinch` : 'wants to pinch someone',
                bait: targetStr ? `baits ${targetStr}` : 'is baiting',
                smile: targetStr ? `smiles at ${targetStr}` : 'is smiling',
                laugh: targetStr ? `laughs at ${targetStr}` : 'is laughing',
                tease: targetStr ? `teases ${targetStr}` : 'is feeling teasing',
                smooch: targetStr ? `gives ${targetStr} a smooch` : 'wants a smooch',
                romance: targetStr ? `romances ${targetStr}` : 'is feeling romantic',
                love: targetStr ? `loves ${targetStr}` : 'is feeling loving',
                hate: targetStr ? `hates ${targetStr}` : 'is feeling hateful',
                hifi: targetStr ? `gives ${targetStr} a high-five` : 'wants a high-five',
                hi: targetStr ? `says hi to ${targetStr}` : 'is saying hi',
                deal: targetStr ? `makes a deal with ${targetStr}` : 'wants to make a deal',
                happy: targetStr ? `is happy with ${targetStr}` : 'is happy',
                sad: targetStr ? `is sad with ${targetStr}` : 'is sad',
                count: targetStr ? `counts with ${targetStr}` : 'is counting',
                fuck: targetStr ? `pins ${targetStr} against the wall` : 'is acting bold',
                propose: targetStr ? `proposes to ${targetStr}` : 'is proposing to the air',
                throw: targetStr ? `throws ${targetStr} across the room` : 'is throwing things',
                crush: targetStr ? `has a crush on ${targetStr}` : 'is crushing hard',
                eat: targetStr ? `takes a bite out of ${targetStr}` : 'is eating',
                secure: targetStr ? `securely holds ${targetStr}` : 'is securing the area',
                lock: targetStr ? `locks arms with ${targetStr}` : 'is locked in',
                unlock: targetStr ? `unlocks ${targetStr}` : 'is unlocked',
                tie: targetStr ? `ties up ${targetStr}` : 'is tying knots',
                hold: targetStr ? `holds ${targetStr}` : 'wants to be held',
                bye: targetStr ? `waves goodbye to ${targetStr}` : 'says goodbye',
                tata: targetStr ? `says ta-ta to ${targetStr}` : 'says ta-ta',
                squeeze: targetStr ? `squeezes ${targetStr}` : 'is squeezing',
                gesture: targetStr ? `gestures to ${targetStr}` : 'makes a gesture',
                pray: targetStr ? `prays for ${targetStr}` : 'is praying',
                please: targetStr ? `begs ${targetStr}` : 'says please',
                tweak: targetStr ? `tweaks ${targetStr}` : 'is tweaking',
                comb: targetStr ? `combs ${targetStr}'s hair` : 'is combing hair',
                alert: targetStr ? `alerts ${targetStr}` : 'is on high alert',
                wipe: targetStr ? `wipes ${targetStr}` : 'is wiping',
                swipe: targetStr ? `swipes at ${targetStr}` : 'is swiping',
                play: targetStr ? `plays with ${targetStr}` : 'is playing',
                blush: targetStr ? `blushes at ${targetStr}` : 'is blushing',
                shy: targetStr ? `is acting shy around ${targetStr}` : 'is feeling shy',
                marry: targetStr ? `marries ${targetStr}` : 'is getting married',
                bully: targetStr ? `bullies ${targetStr}` : 'is being a bully',
                nod: targetStr ? `nods at ${targetStr}` : 'nods',
                feed: targetStr ? `feeds ${targetStr}` : 'is sharing food',
                salute: targetStr ? `salutes ${targetStr}` : 'is saluting',
                point: targetStr ? `points at ${targetStr}` : 'is pointing',
                run: targetStr ? `runs around with ${targetStr}` : 'is running around',
                walk: targetStr ? `walks with ${targetStr}` : 'is walking',
                keep: targetStr ? `keeps ${targetStr} close` : 'is keeping things close',
                wave: targetStr ? `waves at ${targetStr}` : 'is waving',
                ping: targetStr ? `pings ${targetStr}` : 'is pinging',
                call: targetStr ? `calls out to ${targetStr}` : 'is calling out',
                sing: targetStr ? `sings a song for ${targetStr}` : 'is singing',
                movie: targetStr ? `watches a movie with ${targetStr}` : 'is watching a movie',
                flex: targetStr ? `flexes on ${targetStr}` : 'is flexing',
                fight: targetStr ? `fights with ${targetStr}` : 'wants to fight',
                awkward: targetStr ? `feels awkward around ${targetStr}` : 'feels awkward',
                akward: targetStr ? `feels awkward around ${targetStr}` : 'feels awkward',
                bury: targetStr ? `buries ${targetStr}` : 'is burying things',
                drink: targetStr ? `drinks with ${targetStr}` : 'is drinking',
                care: targetStr ? `cares for ${targetStr}` : 'is feeling caring',
                kidnap: targetStr ? `kidnaps ${targetStr}` : 'is kidnapping someone',
                rotate: targetStr ? `rotates ${targetStr}` : 'is rotating',
                revolve: targetStr ? `revolves around ${targetStr}` : 'is revolving',
                swing: targetStr ? `swings ${targetStr} around` : 'is swinging',
                jiggle: targetStr ? `jiggles ${targetStr}` : 'is jiggling',
                chop: targetStr ? `karate chops ${targetStr}` : 'is doing karate chops',
                fire: targetStr ? `fires at ${targetStr}` : 'is firing',
                train: targetStr ? `trains with ${targetStr}` : 'is training',
                dress: targetStr ? `dresses up ${targetStr}` : 'is dressing up',
                tag: targetStr ? `tags ${targetStr}` : 'is playing tag',
                bath: targetStr ? `bathes ${targetStr}` : 'is taking a bath',
                dump: targetStr ? `dumps ${targetStr}` : 'is dumping things'
              };

              let desc = '';
              if (actionSentences[actionRaw]) {
                desc = `**<@${message.author.id}> ${actionSentences[actionRaw]}!**`;
              } else {
                // Fallback for any unknown/default actions
                let verb = actionRaw;
                if (verb.endsWith('s') || verb.endsWith('h') || verb.endsWith('x') || verb.endsWith('z')) verb += 'es';
                else if (verb.endsWith('y') && !['a','e','i','o','u'].includes(verb[verb.length-2])) verb = verb.slice(0, -1) + 'ies';
                else verb += 's';

                desc = targetStr ? `**<@${message.author.id}> ${verb} ${targetStr}!**` : `**<@${message.author.id}> ${verb}!**`;
              }

              const rpEmbed = new EmbedBuilder()
                .setColor(dbConfig.accentColor ? parseInt(dbConfig.accentColor.replace('#', ''), 16) : 0x2b2d31)
                .setDescription(desc)
                .setFooter({ text: 'Athena Prime Roleplay' });

              const gifUrl = await getCachedGif(mappedAction);
              if (gifUrl) rpEmbed.setImage(gifUrl);

              await message.reply({ embeds: [rpEmbed] }).catch(() => null);
              return; // Stop processing so it doesn't trigger normal prefix parser
          } catch (err) {
            console.error('[Roleplay] Error fetching GIF:', err);
            // If it fails, silently fall through, but we should probably stop the unknown command error.
            return message.reply({ content: `❌ Could not load a GIF for \`${actionRaw}\` at the moment.` }).catch(() => null);
          }
        }
      }
    }

    // ==========================================
    // 0. OWNER MENTION DETECTION
    // ==========================================
    const ownerId = process.env.OWNER_ID;
    if (ownerId && userId !== ownerId && message.mentions.has(ownerId)) {
      const nowMs = Date.now();
      const lastPing = masterPingCooldowns.get(guildId) || 0;
      
      // 3 minute (180000ms) cooldown per guild
      if (nowMs - lastPing >= 180000) {
        masterPingCooldowns.set(guildId, nowMs);

        try {
          const presence = getPresenceStatus(message.guild, ownerId);

          const cfg = db.getGuildConfig(message.guild.id);
          const embedColor = cfg.accentColor ? parseInt(cfg.accentColor.replace('#', ''), 16) : 0x2b2d31;

          const ownerEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setDescription(`# You tagged my Master !\n\n> Status: **${presence.text.toUpperCase()}**\n\nYour ping has been forwarded through direct messages.\nAwait his arrival.`)
            .setFooter({ text: `${message.client.user.username} Security • Today at ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })} IST` });

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
        } catch (err) {
          console.error('[Owner Mention]', err);
        }
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

        const maxWarnings = dbConfig.maxWarnings || 3;
        const warns = db.addWarning(guildId, userId, message.client.user.id, `Automated AutoMod: Unauthorized Invite Link`);

        logToSecurityChannel(message.guild, embed.log(
          'Invite Link Filtered',
          `Deleted invite promotion from member.`,
          [
            { name: 'Member', value: `${message.author.tag} (${userId})`, inline: true },
            { name: 'Channel', value: `${message.channel}`, inline: true },
            { name: 'Warnings Count', value: `\`${warns.length}\` / ${maxWarnings}`, inline: true },
            { name: 'Content Filtered', value: `\`\`\`${message.content}\`\`\`` }
          ],
          'warning'
        ));

        if (warns.length >= maxWarnings) {
          const quarantineReason = `Automated: Warning threshold limit exceeded (${warns.length}/${maxWarnings} Warnings)`;
          const quarantineRes = await executeQuarantine(message.guild, message.member, message.guild.members.me, quarantineReason);
          
          db.clearWarnings(guildId, userId);

          const criticalEmbed = embed.danger(
            'Invite Quarantine Protocol',
            `**${message.author.tag}** has been automatically **quarantined** for exceeding maximum invite warning thresholds (${warns.length}/${maxWarnings}).\n\n${quarantineRes.message || ''}`
          );
          await message.channel.send({ embeds: [criticalEmbed] }).catch(() => null);
        } else {
          const warnEmbed = embed.warn(
            '<:gun:1517636066964799679> Invite Deleted',
            `${message.author}, invite links are strictly prohibited in this guild to prevent promotion spam.\n\n**Warning Count:** \`${warns.length}\` / ${maxWarnings}`
          );
          await message.channel.send({ embeds: [warnEmbed] }).catch(() => null);
        }
        
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
              '<:gun:1517636066964799679> Link Deleted',
              `${message.author}, posting links is not allowed in this server.`
            );
            await message.channel.send({ embeds: [warnEmbed] }).catch(() => null);

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
            `**${message.author.tag}** has been automatically **quarantined** for exceeding maximum word filter warning thresholds (${warns.length}/${maxWarnings}).\n\n${quarantineRes.message || ''}`
          );
          await message.channel.send({ embeds: [criticalEmbed] }).catch(() => null);
        } else {
          const filterWarnEmbed = embed.warn(
            '<:gun:1517636066964799679> Word Filter Triggered',
            `${message.author}, your message contained a blacklisted word and was deleted.\n\n**Warning Count:** \`${warns.length}\` / ${maxWarnings}`
          );
          await message.channel.send({ embeds: [filterWarnEmbed] }).catch(() => null);
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
              `**${message.author.tag}** has been automatically **isolated and quarantined** for severe server spamming.\n\n${quarantineRes.message || ''}`
            );
            await message.channel.send({ embeds: [criticalEmbed] }).catch(() => null);
          } else {
            const spamWarnEmbed = embed.warn(
              '<:gun:1517636066964799679> Anti-Spam Warning',
              `${message.author}, please slow down. Sending messages too fast is against server security rules.\n\n**Warning Count:** \`${warns.length}\` / ${maxWarnings}`
            );
            await message.channel.send({ embeds: [spamWarnEmbed] }).catch(() => null);
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
              const embedColor = dbConfig.accentColor ? parseInt(dbConfig.accentColor.replace('#', ''), 16) : 0x2b2d31;
              const e = new EmbedBuilder().setImage(responseText).setColor(embedColor);
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
        .setDescription(`> **| ${apiMs}MS |**`);

      const e2 = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`\u2800\n> **• PONG**\n> WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms`)
        .setThumbnail(message.author.displayAvatarURL({ size: 256 }));

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

    // STATS TRACKER: Log user and channel message
    statsDB.logMessage(message.guild.id, message.author.id, message.channel.id);

    // --- PREFIX COMMAND HANDLING ---
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
    const botMention = `<@${message.client.user.id}>`;
    const botMentionSpace = `<@${message.client.user.id}> `;
    const botMentionNick = `<@!${message.client.user.id}>`;
    const botMentionNickSpace = `<@!${message.client.user.id}> `;

    let usedPrefix = null;
    if (message.content.startsWith(prefix)) usedPrefix = prefix;
    else if (message.content.startsWith(botMentionSpace)) usedPrefix = botMentionSpace;
    else if (message.content.startsWith(botMentionNickSpace)) usedPrefix = botMentionNickSpace;
    else if (message.content.startsWith(botMention)) usedPrefix = botMention;
    else if (message.content.startsWith(botMentionNick)) usedPrefix = botMentionNick;

    if (!usedPrefix) return;

    const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // These are handled by dedicated prefix-less handlers — skip to avoid double response
    if (commandName === 'ezal' || commandName === 'backup' || commandName === 'enuke' || commandName === 'spam' || commandName === 'qr') return;

    const cmd = commandMap.get(commandName);

    // Intelligent command error correction with fuzzy matching
    if (!cmd) {
      const closest = findClosestCommand(commandName, [...commandMap.keys()]);
      const triggerUsed = usedPrefix === prefix ? prefix : `@${message.client.user.username} `;
      
      if (closest) {
        const suggestEmbed = embed.warn(
          'Unknown Command',
          `${message.author} ❌ Command \`${triggerUsed}${commandName}\` not found.\n\n💡 Did you mean: \`${prefix}${closest}\`?\n\nUse \`${prefix}help\` for all commands.`
        );
        return message.reply({ embeds: [suggestEmbed] }).catch(() => null);
      } else {
        const notFoundEmbed = embed.warn(
          'Unknown Command',
          `${message.author} ❌ Command \`${triggerUsed}${commandName}\` does not exist.\n\nUse \`${prefix}help\` for all available commands.`
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
      console.error(error);
      const errEmbed = embed.danger('Execution Error', `An unexpected error occurred while executing this command.`);
      await message.reply({ embeds: [errEmbed] }).catch(() => null);
    }
  }
};
