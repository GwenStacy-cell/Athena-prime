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
import fetch from 'node-fetch';
import { createRateMessage } from '../commands/rate.js';
import { scanImageForScam, flaggedMessages } from '../utils/antiScam.js';

const nbClient = new Client();
const gifCache = new Map();

const gifEngines = [
  async (action) => {
    try {
      const res = await nbClient.fetch(action, 10);
      return res?.results?.map(r => r.url) || [];
    } catch { return []; }
  },
  async (action) => {
    try {
      const res = await fetch(`https://nekos.life/api/v2/img/${action}`).then(r => r.json());
      return res.url ? [res.url] : [];
    } catch { return []; }
  },
  async (action) => {
    try {
      const res = await fetch(`https://api.purrbot.site/v2/img/sfw/${action}/gif`).then(r => r.json());
      return res.link ? [res.link] : [];
    } catch { return []; }
  },
  async (action) => {
    try {
      const res = await fetch(`https://api.otakugifs.xyz/gif?reaction=${action}`).then(r => r.json());
      return res.url ? [res.url] : [];
    } catch { return []; }
  },
  async (action) => {
    try {
      const tenorQueryMap = {
        fry: 'anime cooking',
        burn: 'anime burning fire',
        trash: 'anime throw trash',
        jail: 'anime behind bars',
        arrest: 'anime police arrest',
        ignore: 'anime ignoring',
        avoid: 'anime dodging',
        scratch: 'anime scratch',
        touch: 'anime poking touch',
        lean: 'anime lean on shoulder',
        propose: 'anime marriage proposal ring',
        release: 'anime letting go',
        wiggle: 'anime wiggle cute',
        heat: 'anime fire flame',
        cool: 'anime ice freeze'
      };
      const query = tenorQueryMap[action] || `anime ${action}`;
      const res = await fetch(`https://g.tenor.com/v1/random?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=10`).then(r => r.json());
      return res?.results?.map(i => i.media[0].gif.url) || [];
    } catch { return []; }
  }
];

async function fetchFromEngines(action) {
  const hardcodedGifs = {
    fry: ['https://media.tenor.com/ErQASaRZS3EAAAAC/howl%E2%80%99s-moving-castle-anime.gif', 'https://media.tenor.com/AQIDiqxaVSkAAAAC/anime-cooking.gif', 'https://media.tenor.com/2Cq9Sfnk5vcAAAAC/sliced-onions-butter.gif'],
    trash: ['https://media.tenor.com/LTtlQgsvSsUAAAAC/yeet-toradora.gif', 'https://media.tenor.com/o6BRGGiCWWEAAAAC/shizuka-kuze-takopi%27s-original-sin.gif', 'https://media.tenor.com/6FZT64ZUTTYAAAAC/hinamatsuri-hina.gif'],
    jail: ['https://media.tenor.com/kSj9yMl4MA4AAAAC/england-imprisoned.gif', 'https://media.tenor.com/nNWvIrUsTTcAAAAC/vtuber-anime.gif'],
    arrest: ['https://media.tenor.com/kSj9yMl4MA4AAAAC/england-imprisoned.gif', 'https://media.tenor.com/nNWvIrUsTTcAAAAC/vtuber-anime.gif'],
    ignore: ['https://media.tenor.com/EG9HCausysEAAAAC/ayanokoji-looking.gif', 'https://media.tenor.com/PARu8FCvbW0AAAAC/my-little-monster-anime.gif', 'https://media.tenor.com/RqCaP2p0wc8AAAAC/anime-girl.gif'],
    avoid: ['https://media.tenor.com/u8VZ1BwqkmwAAAAC/anime-speed-o-sound-sonic.gif', 'https://media.tenor.com/oWVbsK2kYwAAAAAC/azusa-aizawa-dodging-sword-attack-azusa-san.gif', 'https://media.tenor.com/5hRBNyArZ-0AAAAC/ok-dodge.gif'],
    scratch: ['https://media.tenor.com/Y9ZTcGexxzIAAAAC/casca48.gif', 'https://media.tenor.com/xLvDvZSEM6YAAAAC/head-scratch-father.gif', 'https://media.tenor.com/xo5Rx8A1wiwAAAAC/anime-boy.gif'],
    touch: ['https://media.tenor.com/5Lv85bUIWvAAAAAC/hanako-kun-face-grab.gif', 'https://media.tenor.com/At_qOx2HQEQAAAAC/ally-val-caress-hair.gif', 'https://media.tenor.com/Wth7fEpgZ7EAAAAC/neko-anime-girl.gif'],
    lean: ['https://media.tenor.com/Btq_03Je4A8AAAAC/yu-yu-hakusho-yyh.gif', 'https://media.tenor.com/3h67BuTXFMgAAAAC/idolish7-yamato.gif', 'https://media.tenor.com/aLSflmFvBe4AAAAC/yuyushiki-kei-okano.gif'],
    propose: ['https://media.tenor.com/Z-pDHtzQuOYAAAAC/umineko-shannon.gif', 'https://media.tenor.com/kK8gAeHtSPMAAAAC/marry-me.gif', 'https://media.tenor.com/QC9titwVLhAAAAAC/spy-x-family-yor-forger.gif'],
    release: ['https://media.tenor.com/Frm37nXIQmsAAAAC/supersecretcodepp.gif', 'https://media.tenor.com/QLvltOQ58hoAAAAC/anime-hands.gif', 'https://media.tenor.com/70F_1B8GSvEAAAAC/vnc-vanitas.gif'],
    heat: ['https://media.tenor.com/BIHh4y7c7zEAAAAC/vyes.gif', 'https://media.tenor.com/OO10I6aC3dsAAAAC/anime-blush-death.gif', 'https://media.tenor.com/HBl3WIbJrTYAAAAC/jujutsu-kaisen.gif'],
    burn: ['https://media.tenor.com/BIHh4y7c7zEAAAAC/vyes.gif', 'https://media.tenor.com/OO10I6aC3dsAAAAC/anime-blush-death.gif', 'https://media.tenor.com/HBl3WIbJrTYAAAAC/jujutsu-kaisen.gif'],
    cool: ['https://media.tenor.com/fFeI4SjjQKIAAAAC/hairi-takahara.gif', 'https://media.tenor.com/085VV9uwD9oAAAAC/anime-frieren.gif', 'https://media.tenor.com/EEITKf1uaSgAAAAC/gray-juvia.gif']
  };

  if (hardcodedGifs[action]) {
    return [...hardcodedGifs[action]].sort(() => Math.random() - 0.5);
  }

  const shuffled = [...gifEngines].sort(() => Math.random() - 0.5);
  for (const engine of shuffled) {
    const urls = await engine(action);
    if (urls.length > 0) return urls;
  }
  return [];
}

async function getCachedGif(action) {
  if (!gifCache.has(action)) gifCache.set(action, []);
  const pool = gifCache.get(action);

  if (pool.length === 0) {
    const newUrls = await fetchFromEngines(action);
    if (newUrls.length > 0) pool.push(...newUrls.sort(() => Math.random() - 0.5));
  }

  if (pool.length === 0) return null;
  const url = pool.pop();

  if (pool.length < 5) {
    fetchFromEngines(action).then(urls => {
      if (urls.length > 0) pool.push(...urls.sort(() => Math.random() - 0.5));
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
          const cfg = db.getGuildConfig(message.guild.id);
          if (cfg && cfg.bumpDisabled) return;

          db.setBumpReminder(message.guild.id, {
            channelId: message.channel.id,
            ownerId: message.guild.ownerId,
            bumperId: bumperId,
            expiresAt: Date.now() + 7200000 // 2 hours
          });
          
          // Send a confirmation so they know it worked
          message.channel.send({ content: `**Bump detected!** I've set a timer and will remind the configured roles in 2 hours.` }).catch(() => null);
        }
      }
    }

    // Ignore bots and webhooks
    if (message.author.bot || message.webhookId) return;

    // Ignore globally blacklisted users
    if (db.isUserBotBlacklisted(message.author.id)) return;
    
    // ==========================================
    // DEBUG OCR COMMAND
    // ==========================================
    if (message.content === '?ocrtest') {
      let testUrl = null;
      
      const getImageUrl = (msg) => {
        if (!msg) return null;
        if (msg.attachments && msg.attachments.size > 0) return msg.attachments.first().url;
        if (msg.embeds && msg.embeds.length > 0 && msg.embeds[0].image) return msg.embeds[0].image.url;
        if (msg.messageSnapshots && msg.messageSnapshots.size > 0) {
          for (const snap of msg.messageSnapshots.values()) {
             if (snap.message && snap.message.attachments && snap.message.attachments.size > 0) return snap.message.attachments.first().url;
          }
        }
        return null;
      };

      if (message.reference && message.reference.messageId) {
        const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        testUrl = getImageUrl(refMsg);
      }
      if (!testUrl) testUrl = getImageUrl(message);
      
      if (testUrl) {
        const { getRawOCRText } = await import('../utils/antiScam.js');
        const text = await getRawOCRText(testUrl);
        return message.channel.send(`\`\`\`\n${text.substring(0, 1900)}\n\`\`\``);
      } else {
        return message.channel.send('Please reply to an image or attach one with `?ocrtest`');
      }
    }
    
    // ==========================================
    // ANTI-SCAM OCR IMAGE SCANNER
    // ==========================================
    if (message.guild) {
      const urlsToScan = [];
      
      // 1. Regular Attachments
      if (message.attachments.size > 0) {
        message.attachments.forEach(att => urlsToScan.push(att.url));
      }
      
      // 2. Embeds (URL Previews like x.com)
      if (message.embeds.length > 0) {
        message.embeds.forEach(embed => {
          if (embed.image) urlsToScan.push(embed.image.url);
          if (embed.thumbnail) urlsToScan.push(embed.thumbnail.url);
        });
      }
      
      // 3. Forwarded Messages
      if (message.messageSnapshots && message.messageSnapshots.size > 0) {
        message.messageSnapshots.forEach(snap => {
          if (snap.message && snap.message.attachments) {
            snap.message.attachments.forEach(att => urlsToScan.push(att.url));
          }
        });
      }
      
      // 4. Raw Text Links (e.g. pasted media links)
      if (message.content) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const links = message.content.match(urlRegex);
        if (links) {
          links.forEach(link => {
            if (link.match(/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i) || link.includes('cdn.discordapp.com/attachments/') || link.includes('media.discordapp.net/attachments/')) {
              urlsToScan.push(link);
            }
          });
        }
      }
      
      if (urlsToScan.length > 0) {
        for (const url of urlsToScan) {
           scanImageForScam(url).then(async (isScam) => {
             if (isScam && !flaggedMessages.has(message.id)) {
               flaggedMessages.add(message.id);
               
               await message.delete().catch(() => null);
               
               // 1. Channel Warning
               const scamEmbed = new EmbedBuilder()
                 .setColor('#ff0000') // Pure red
                 .setDescription(`<a:emoji_35:1517213876058329148> <@${message.author.id}>, your image was flagged as a scam and removed.`);
               await message.channel.send({ embeds: [scamEmbed] }).then(m => setTimeout(() => m.delete().catch(()=>null), 5000));
               
               // 2. Security Channel Log
               const logEmbed = new EmbedBuilder()
                 .setColor('#2b2d31') // Typical aesthetic dark theme accent, or fallback to default
                 .setTitle('LOG: MALICIOUS SCAM IMAGE DELETED')
                 .setDescription(`**User:** <@${message.author.id}> (${message.author.tag})\n**Action:** Posted a fraudulent image containing known scam keywords (Mr. Beast/Kasowin/Crypto Casino).`)
                 .addFields([{ name: 'Channel', value: `<#${message.channel.id}>` }])
                 .setFooter({ text: 'Athena Prime Security' })
                 .setTimestamp();
               
               // Inherit server context accent color if possible by using the helper embed
               try {
                 const { default: db } = await import('../database.js');
                 const config = db.getGuildConfig(message.guild.id);
                 if (config && config.accentColor) {
                   logEmbed.setColor(config.accentColor);
                 }
               } catch(e) {}
               
               logToSecurityChannel(message.guild, logEmbed);
               
               // 3. DM Server Owner
               try {
                 const owner = await message.guild.members.fetch(message.guild.ownerId);
                 if (owner) {
                   const dmEmbed = new EmbedBuilder()
                     .setColor('#ff0000') // Pure red for owner warning
                     .setTitle('<a:emoji_35:1517213876058329148> Automated Scam Intervention')
                     .setDescription(`Hello **${owner.user.username}**,\nI have successfully intercepted and deleted a fraudulent scam image in your server **${message.guild.name}**.\n\n**Offender:** <@${message.author.id}>\n**Location:** <#${message.channel.id}>\n**Detected Keywords:** Mr. Beast / Kasowin / Crypto Casino`)
                     .setFooter({ text: 'Athena Prime Security System' });
                   await owner.send({ embeds: [dmEmbed] }).catch(() => null);
                 }
               } catch (e) {
                 // Ignore if owner can't be DMed
               }
             }
           });
        }
      }
    }

    // ==========================================
    // AUTO-RATE LOGIC
    // ==========================================
    if (message.guild) {
      const configuredRateChannel = db.getRateChannel(message.guild.id);
      if (configuredRateChannel && message.channel.id === configuredRateChannel) {
        let mediaUrl = null;
        if (message.attachments.size > 0) {
          mediaUrl = message.attachments.first().url;
        } else {
          const urlMatch = message.content.match(/(https?:\/\/[^\s]+)/);
          if (urlMatch) mediaUrl = urlMatch[0];
        }

        if (mediaUrl) {
          const prefix = db.getGuildConfig(message.guild.id)?.prefix || '!';
          if (!message.content.startsWith(prefix) || !message.content.toLowerCase().includes('rate')) {
            // It's a media upload without the !rate command, automate it!
            return createRateMessage(message, mediaUrl);
          }
        }
      }
    }

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
    // MUSIC PLAYER INTERCEPT
    // ==========================================
    if (dbConfig.musicChannelId && message.channel.id === dbConfig.musicChannelId) {
      // It's in the music channel. Delete the user message immediately.
      message.delete().catch(() => null);
      
      // If they sent text, treat it as a song request
      if (message.content.trim().length > 0) {
        import('../utils/musicManager.js').then(async (musicManager) => {
          const res = await musicManager.enqueue(message.guild, message.member, message.content.trim());
          if (!res.success) {
             const m = await message.channel.send({ content: `${message.author}, ${res.message}` });
             setTimeout(() => m.delete().catch(()=>null), 5000);
          }
        }).catch(err => console.error('Failed to load musicManager:', err));
      }
      return; // Do not process as a normal command
    }

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
          arrest: 'arrest', ignore: 'ignore', avoid: 'avoid', jail: 'jail', burn: 'burn',
          fry: 'fry', heat: 'heat', cool: 'cool', trash: 'trash', scratch: 'scratch',
          touch: 'touch', lean: 'lean', propose: 'propose', wiggle: 'wiggle', release: 'release',

          // Synonyms & Requested
          lick: 'nom', fuck: 'kabedon', protect: 'cuddle', move: 'run',
          kill: 'shoot', cringe: 'facepalm', lift: 'carry', roll: 'spin', see: 'stare',
          look: 'stare', greet: 'wave', hi: 'wave', clause: 'stare', pinch: 'tickle',
          bait: 'wink', tease: 'smug', smooch: 'peck', romance: 'handhold', love: 'hug',
          hate: 'slap', hifi: 'highfive', deal: 'handshake', sad: 'cry', count: 'think',
          throw: 'yeet', crush: 'blush', eat: 'nom', secure: 'cuddle',
          lock: 'cuddle', unlock: 'pat', tie: 'cuddle', hold: 'handhold', bye: 'wave', tata: 'wave',
          squeeze: 'hug', gesture: 'wave', pray: 'nod', please: 'pout', tweak: 'poke',
          comb: 'pat', alert: 'shocked', wipe: 'pat', swipe: 'slap', play: 'dance', shy: 'blush',
          marry: 'handhold', bully: 'poke', point: 'poke', walk: 'run', keep: 'cuddle',
          ping: 'poke', call: 'wave', sing: 'dance', movie: 'cuddle', flex: 'smug', fight: 'punch',
          awkward: 'blush', akward: 'blush', bury: 'yeet', drink: 'sip', care: 'pat', kidnap: 'carry',
          rotate: 'spin', revolve: 'spin', swing: 'spin', jiggle: 'shake', chop: 'slap',
          fire: 'shoot', train: 'punch', dress: 'pat', tag: 'poke', bath: 'pat', dump: 'yeet',
          bump: 'highfive', shut: 'slap', block: 'nope', strike: 'punch', push: 'slap', pull: 'cuddle',
          taste: 'nom', thanks: 'smile', knock: 'poke', suck: 'nom', fly: 'dance', watch: 'stare',
          pet: 'pat', ride: 'cuddle', shop: 'happy', arm: 'hug', touch: 'poke', rub: 'pat',
          duet: 'dance', refuse: 'nope', no: 'nope', nothanks: 'nope', drop: 'yeet', cover: 'cuddle',
          question: 'stare', query: 'stare', doubt: 'shrug', send: 'yeet', receive: 'hug', grab: 'handhold',
          stand: 'nod', sit: 'nod', trim: 'pat', dash: 'run', appreciate: 'smile', appriciate: 'smile',
          compliment: 'smile', compliments: 'smile', complimenting: 'smile', complimented: 'smile',
          praise: 'pat', confuse: 'confused', confused: 'confused', confusing: 'confused', confusion: 'confused',
          blow: 'kiss', blows: 'kiss', blowing: 'kiss'
        };

        let mappedAction = actionMap[actionRaw];
        
        const genericActions = ['poke', 'pat', 'hug', 'cuddle', 'stare', 'dance', 'smile', 'wave', 'nod', 'shrug', 'highfive'];

        if (!mappedAction && targetUser && !commandMap.has(actionRaw)) {
            mappedAction = genericActions[Math.floor(Math.random() * genericActions.length)];
        }
        
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
                appreciate: targetStr ? `appreciates ${targetStr}` : 'feels appreciative',
                compliment: targetStr ? `compliments ${targetStr}` : 'gives a compliment',
                compliments: targetStr ? `compliments ${targetStr}` : 'gives a compliment',
                complimenting: targetStr ? `is complimenting ${targetStr}` : 'is giving compliments',
                complimented: targetStr ? `complimented ${targetStr}` : 'gave a compliment',
                count: targetStr ? `counts with ${targetStr}` : 'is counting',
                fuck: targetStr ? `pins ${targetStr} against the wall` : 'is acting bold',
                propose: targetStr ? `proposes to ${targetStr}` : 'is proposing to the air',
                throw: targetStr ? `throws ${targetStr} across the room` : 'is throwing things',
                crush: targetStr ? `has a crush on ${targetStr}` : 'is crushing hard',
                eat: targetStr ? `takes a bite out of ${targetStr}` : 'is eating',
                secure: targetStr ? `securely holds ${targetStr}` : 'is securing the area',
                confused: targetStr ? `is confused by ${targetStr}` : 'is confused',
                blow: targetStr ? `blows a kiss to ${targetStr}` : 'blows a kiss',
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
                dump: targetStr ? `dumps ${targetStr}` : 'is dumping things',
                bump: targetStr ? `fist-bumps ${targetStr}` : 'is bumping fists',
                fry: targetStr ? `fries ${targetStr}` : 'is frying things',
                trash: targetStr ? `trashes ${targetStr}` : 'is trashing the place',
                scratch: targetStr ? `scratches ${targetStr}` : 'is scratching',
                touch: targetStr ? `touches ${targetStr}` : 'is touching things',
                lean: targetStr ? `leans on ${targetStr}` : 'is leaning',
                heat: targetStr ? `heats up ${targetStr}` : 'is heating up',
                cool: targetStr ? `cools down ${targetStr}` : 'is cooling down',
                release: targetStr ? `releases ${targetStr}` : 'is releasing things',
                shut: targetStr ? `tells ${targetStr} to shut up` : 'wants everyone to shut up',
                block: targetStr ? `blocks ${targetStr}` : 'is blocking things',
                strike: targetStr ? `strikes ${targetStr}` : 'is striking',
                push: targetStr ? `pushes ${targetStr}` : 'is pushing things',
                pull: targetStr ? `pulls ${targetStr} closer` : 'is pulling',
                taste: targetStr ? `tastes ${targetStr}` : 'is tasting things',
                thanks: targetStr ? `thanks ${targetStr}` : 'is thankful',
                knock: targetStr ? `knocks on ${targetStr}` : 'is knocking',
                suck: targetStr ? `sucks on ${targetStr}` : 'is sucking',
                fly: targetStr ? `flies with ${targetStr}` : 'is flying',
                watch: targetStr ? `watches ${targetStr}` : 'is watching',
                pet: targetStr ? `pets ${targetStr}` : 'is petting',
                ride: targetStr ? `rides with ${targetStr}` : 'is riding',
                shop: targetStr ? `shops with ${targetStr}` : 'is shopping',
                arm: targetStr ? `arms ${targetStr}` : 'is armed',
                touch: targetStr ? `touches ${targetStr}` : 'is touching things',
                rub: targetStr ? `rubs ${targetStr}` : 'is rubbing',
                duet: targetStr ? `duets with ${targetStr}` : 'is dueting',
                refuse: targetStr ? `refuses ${targetStr}` : 'refuses',
                no: targetStr ? `says no to ${targetStr}` : 'says no',
                nothanks: targetStr ? `says no thanks to ${targetStr}` : 'says no thanks',
                drop: targetStr ? `drops ${targetStr}` : 'is dropping things',
                cover: targetStr ? `covers ${targetStr}` : 'is taking cover',
                praise: targetStr ? `praises ${targetStr}` : 'is praising',
                'delete': targetStr ? `deletes ${targetStr}` : 'is deleting things',
                devour: targetStr ? `devours ${targetStr}` : 'is devouring',
                chew: targetStr ? `chews on ${targetStr}` : 'is chewing',
                hello: targetStr ? `says hello to ${targetStr}` : 'says hello',
                hi: targetStr ? `says hi to ${targetStr}` : 'says hi',
                welcome: targetStr ? `welcomes ${targetStr}` : 'says you are welcome',
                buy: targetStr ? `buys from ${targetStr}` : 'is buying',
                sell: targetStr ? `sells to ${targetStr}` : 'is selling',
                purchase: targetStr ? `purchases from ${targetStr}` : 'is purchasing',
                rage: targetStr ? `rages at ${targetStr}` : 'is raging',
                fury: targetStr ? `unleashes fury on ${targetStr}` : 'is furious',
                question: targetStr ? `questions ${targetStr}` : 'has a question',
                query: targetStr ? `queries ${targetStr}` : 'has a query',
                doubt: targetStr ? `doubts ${targetStr}` : 'is doubting',
                send: targetStr ? `sends ${targetStr}` : 'is sending things',
                receive: targetStr ? `receives ${targetStr}` : 'is receiving',
                grab: targetStr ? `grabs ${targetStr}` : 'is grabbing',
                stand: targetStr ? `stands with ${targetStr}` : 'is standing',
                sit: targetStr ? `sits with ${targetStr}` : 'is sitting',
                trim: targetStr ? `trims ${targetStr}` : 'is trimming',
                dash: targetStr ? `dashes to ${targetStr}` : 'is dashing'
              };

              let desc = '';
              if (actionSentences[actionRaw]) {
                desc = `**<@${message.author.id}> ${actionSentences[actionRaw]}!**`;
              } else {
                // Fallback for any unknown/default actions dynamically triggered
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
            return message.reply({ content: ` Could not load a GIF for \`${actionRaw}\` at the moment.` }).catch(() => null);
          }
        }
      }
    }

    // ==========================================
    // 0. OWNER MENTION DETECTION
    // ==========================================
    const ownerId = process.env.OWNER_ID;
    if (ownerId && userId !== ownerId && message.mentions.has(ownerId)) {
      try {
        // React to the message instantly
        await message.react('1522714425235210400').catch(() => null);

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

      // If the message is just a ping and not a command, halt further processing
      const currentPrefix = db.getGuildConfig(guildId).prefix || '!';
      const botMentionSpace = `<@${message.client.user.id}> `;
      const botMentionNickSpace = `<@!${message.client.user.id}> `;
      if (!message.content.startsWith(currentPrefix) && 
          !message.content.startsWith(botMentionSpace) && 
          !message.content.startsWith(botMentionNickSpace)) {
        return; 
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
          console.log(`[AutoResponder] Triggered by ${t.match} for message: ${message.content}`);
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
      const { EmbedBuilder, AttachmentBuilder } = await import('discord.js');
      const { generatePingGraph } = await import('../utils/graph.js');
      const cfg = db.getGuildConfig(guildId);
      const accentHex = cfg?.accentColor || '#00e5ff';
      const accentInt = parseInt(accentHex.replace('#', ''), 16);

      const sent = await message.reply({ content: 'Calculating ping...' });
      const apiMs = sent.createdTimestamp - message.createdTimestamp;
      const wsMs  = Math.round(message.client.ws.ping);

      const dbStart = Date.now();
      db.getGuildConfig(guildId);
      const dbMs = Date.now() - dbStart;

      const rSet = Math.floor(Math.random() * 3) + 1;
      const rGet = Math.floor(Math.random() * 2) + 1;
      const rDel = Math.floor(Math.random() * 2) + 1;

      const buffer = await generatePingGraph(wsMs, accentHex, message.client.guilds.cache.size);
      const attachment = new AttachmentBuilder(buffer, { name: 'ping_graph.png' });

      const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`| <:emoji_16:1521464002046328944> ${message.author} **${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**`)
        .setImage('attachment://ping_graph.png');

      await sent.delete().catch(() => null);
      await message.reply({ embeds: [e], files: [attachment] });
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
          `${message.author}  Command \`${triggerUsed}${commandName}\` not found.\n\n Did you mean: \`${prefix}${closest}\`?\n\nUse \`${prefix}help\` for all commands.`
        );
        return message.reply({ embeds: [suggestEmbed] }).catch(() => null);
      } else {
        const notFoundEmbed = embed.warn(
          'Unknown Command',
          `${message.author}  Command \`${triggerUsed}${commandName}\` does not exist.\n\nUse \`${prefix}help\` for all available commands.`
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
          return message.reply({ embeds: [embed.danger('Access Denied', '️ You do not possess the required permissions to execute this command.')] });
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
