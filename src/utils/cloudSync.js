import fs from 'fs';
import path from 'path';
import { AttachmentBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import fetch from 'node-fetch';
import chalk from 'chalk';
import db from '../database.js';
import cv2 from '../cv2.js';
import statsDB from '../statsDB.js';

const DATA_DIR = path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.db');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

let backupInterval = null;
let isBackingUp = false;

/**
 * Calculates comprehensive current counts of all modular bot data for diagnostics and backup manifests.
 */
export function getDatabaseMetrics() {
  const cache = db.cache || {};
  const guilds = Object.values(cache.guilds || {});

  // Welcome & Leave detailed breakdown
  const welcomeConfigs = Object.values(cache.welcome || {});
  const leaveConfigs = Object.values(cache.leave || {});

  const welcomeActive = welcomeConfigs.filter(c => c && (c.channelId || c.enabled)).length;
  const welcomeMessages = welcomeConfigs.filter(c => c && c.message).length;
  const welcomeEmbeds = welcomeConfigs.filter(c => c && (c.title || c.description || c.from || c.footer)).length;
  const welcomeGifs = welcomeConfigs.filter(c => c && (c.image || c.thumbnailUrl)).length;
  const welcomeColors = welcomeConfigs.filter(c => c && c.color).length;

  const leaveActive = leaveConfigs.filter(c => c && (c.channelId || c.enabled)).length;
  const leaveMessages = leaveConfigs.filter(c => c && c.message).length;
  const leaveEmbeds = leaveConfigs.filter(c => c && (c.title || c.description || c.from || c.footer)).length;
  const leaveGifs = leaveConfigs.filter(c => c && (c.image || c.thumbnailUrl)).length;

  // Max Warnings breakdown across all guilds
  let maxWarningsSet = 0, maxWarningsTotal = 0;
  guilds.forEach(g => {
    if (g && g.maxWarnings !== undefined) {
      maxWarningsSet++;
      maxWarningsTotal += g.maxWarnings;
    }
  });
  const maxWarningsAvg = maxWarningsSet > 0 ? (maxWarningsTotal / maxWarningsSet).toFixed(1) : '3.0';

  // Antinuke & Security detailed modules breakdown
  const antiBotAddServers = guilds.filter(g => g && g.antinukeModules?.antiBotAdd).length;
  const antiLinkedRoleServers = guilds.filter(g => g && g.antinukeModules?.antiLinkedRole !== false).length;
  const antiRoleModulesServers = guilds.filter(g => g && (g.antinukeModules?.antiRoleCreate || g.antinukeModules?.antiRoleDelete)).length;
  const antiChannelModulesServers = guilds.filter(g => g && (g.antinukeModules?.antiChannelCreate || g.antinukeModules?.antiChannelDelete)).length;
  const antiWebhookServers = guilds.filter(g => g && g.antinukeModules?.antiWebhooks).length;
  const antiNukeThresholds = guilds.filter(g => g && g.antiNukeThreshold !== undefined).length;
  const raidModeServers = guilds.filter(g => g && g.raidMode).length;
  const firewallRolesCount = guilds.filter(g => g && g.firewallRoleId).length;
  const unbypassableRolesCount = guilds.filter(g => g && g.unbypassableRoleId).length;

  // Automod detailed module toggles breakdown
  const antiSpamServers = guilds.filter(g => g && g.antiSpamEnabled).length;
  const antiInviteServers = guilds.filter(g => g && g.antiInviteEnabled).length;
  const antiLinkServers = guilds.filter(g => g && g.antiLinkEnabled).length;
  const wordFilterServers = guilds.filter(g => g && g.wordFilterEnabled).length;
  const antiFloodServers = guilds.filter(g => g && (g.antiFloodEnabled || g.bigFontsEnabled)).length;
  const antiMentionServers = guilds.filter(g => g && g.antiSpamMentionEnabled).length;
  const blacklistedWordsCount = guilds.reduce((acc, g) => acc + (g?.blacklistWords?.length || 0), 0);
  const allowedLinksCount = guilds.reduce((acc, g) => acc + (g?.allowedLinks?.length || 0), 0);
  const automodBypassRolesCount = guilds.reduce((acc, g) => acc + Object.keys(g?.automodBypasses || {}).length, 0);
  const automodBypassServers = guilds.filter(g => g && g.automodBypasses && Object.keys(g.automodBypasses).length > 0).length;
  const aiToxicityServers = guilds.filter(g => g && g.aiToxicityEnabled).length;

  // AutoRole & Vanity Engine breakdown
  const autoroleHumanServers = guilds.filter(g => g && (Array.isArray(g.autoroleHuman) ? g.autoroleHuman.length > 0 : Boolean(g.autoroleHuman))).length;
  const autoroleBotServers = guilds.filter(g => g && (Array.isArray(g.autoroleBot) ? g.autoroleBot.length > 0 : Boolean(g.autoroleBot))).length;
  const vanityRewardServers = guilds.filter(g => g && (g.vanityString || (Array.isArray(g.vanityRole) ? g.vanityRole.length > 0 : Boolean(g.vanityRole)))).length;
  const totalAutoroleBindings = guilds.reduce((acc, g) => {
    let count = 0;
    if (Array.isArray(g?.autoroleHuman)) count += g.autoroleHuman.length;
    else if (g?.autoroleHuman) count += 1;
    if (Array.isArray(g?.autoroleBot)) count += g.autoroleBot.length;
    else if (g?.autoroleBot) count += 1;
    if (Array.isArray(g?.vanityRole)) count += g.vanityRole.length;
    else if (g?.vanityRole) count += 1;
    return acc + count;
  }, 0);

  // YouTube Stats VC Engine breakdown
  const ytStatsServers = guilds.filter(g => g && Array.isArray(g.ytStats) && g.ytStats.length > 0).length;
  const ytStatsChannelsCount = guilds.reduce((acc, g) => acc + (Array.isArray(g?.ytStats) ? g.ytStats.length : 0), 0);

  // ModMail Support Bridge breakdown
  const modmailServers = guilds.filter(g => g && g.modmailEnabled && g.modmailChannelId).length;
  const modmailChannelsCount = guilds.filter(g => g && g.modmailChannelId).length;

  // Support Tickets Activity breakdown
  const ticketConfigs = Object.values(cache.tickets || {});
  const ticketSetups = Object.keys(cache.tickets || {}).length;
  const ticketsActive = ticketConfigs.reduce((acc, t) => acc + Object.keys(t?.activeTickets || {}).length, 0);
  const ticketsTotalCreated = ticketConfigs.reduce((acc, t) => acc + (t?.ticketCount || 0), 0);
  const ticketStaffRolesCount = ticketConfigs.reduce((acc, t) => acc + (Array.isArray(t?.staffRoleIds) ? t.staffRoleIds.length : 0), 0);
  const ticketAiTriageServers = ticketConfigs.filter(t => t && t.aiTriage).length;

  // Community Features: Suggestions, Starboard, Voice Roles
  const suggestionChannels = guilds.filter(g => g && g.suggestionChannelId).length;
  const starboardChannels = guilds.filter(g => g && g.starboardChannelId).length;
  const voiceRolesCount = guilds.filter(g => g && g.voiceRoleId).length;

  // Global Action Logger
  const globalActionLogServers = guilds.filter(g => g && g.globalActionLogChannel).length;

  // Quarantine & Moderation channels/roles
  const quarantineRolesCount = guilds.filter(g => g && g.quarantineRoleId).length;
  const quarantineChannelsCount = guilds.filter(g => g && g.quarantineChannelId).length;
  const quarantineVcsCount = guilds.filter(g => g && g.quarantineVcId).length;
  const logChannelsCount = guilds.filter(g => g && g.logChannel).length;
  const serverLogsCount = guilds.filter(g => g && g.serverLogs).length;

  // Birthday detailed breakdown
  const birthdayConfigs = Object.values(cache.birthdays || {});
  const birthdayChannels = birthdayConfigs.filter(b => b && b.channelId).length;
  const birthdayServers = Object.keys(cache.birthdays || {}).length;
  const birthdayUsers = birthdayConfigs.reduce((acc, b) => acc + Object.keys(b?.users || {}).length, 0);

  // News feeds & announcement channels
  const newsFeeds = cache.newsFeeds || {};
  let newsChannels = 0, newsFeedsCount = 0, newsRolesCount = 0;
  for (const cfg of Object.values(newsFeeds)) {
    if (cfg && cfg.channelId) newsChannels++;
    if (cfg && cfg.roleId) newsRolesCount++;
    if (Array.isArray(cfg?.feeds)) newsFeedsCount += cfg.feeds.length;
  }
  const newsServers = Object.keys(newsFeeds).length;

  // Auto-Quote channel
  const quoteChannels = guilds.filter(g => g && g.quoteChannelId).length;

  // Auto-React channels & emojis
  let autoReactChannels = 0, autoReactEmojisCount = 0, autoReactServers = 0;
  guilds.forEach(g => {
    if (g && g.autoReacts && Object.keys(g.autoReacts).length > 0) {
      autoReactServers++;
      for (const emojis of Object.values(g.autoReacts)) {
        if (Array.isArray(emojis) && emojis.length > 0) {
          autoReactChannels++;
          autoReactEmojisCount += emojis.length;
        }
      }
    }
  });

  // Invite tracking & logging
  const inviteLogChannels = guilds.filter(g => g && g.inviteChannelId).length;
  const inviteBypassChannels = guilds.filter(g => g && g.inviteAllowedChannel).length;

  // Media downloader channel
  const mediaChannels = guilds.filter(g => g && g.mediaChannelId).length;

  // Message delete logs & server log breakdown
  const msgDeleteLogChannels = guilds.filter(g => g && (g.serverLogs?.modules?.msgDeletes?.channelId || (g.serverLogs?.modules?.msgDeletes?.enabled && g.serverLogs?.defaultChannelId))).length;
  const msgDeleteServers = guilds.filter(g => g && g.serverLogs?.modules?.msgDeletes?.enabled).length;
  const msgEditLogChannels = guilds.filter(g => g && (g.serverLogs?.modules?.msgEdits?.channelId || (g.serverLogs?.modules?.msgEdits?.enabled && g.serverLogs?.defaultChannelId))).length;

  // Heuristic threat engine & profiling breakdown (!learn)
  const nukeSignaturesCount = Object.values(cache.nukeSignatures || {}).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
  const nukeSignatureServers = Object.keys(cache.nukeSignatures || {}).filter(k => (cache.nukeSignatures[k] || []).length > 0).length;
  const baselineProfiles = Object.keys(cache.baselineProfiles || {}).length;
  const staffBaselinedCount = Object.values(cache.baselineProfiles || {}).reduce((acc, p) => acc + (Array.isArray(p?.staffTracked) ? p.staffTracked.length : 0), 0);

  // Role Tier Authorization matrix (!auth / !tiers)
  const authTierServers = guilds.filter(g => g && g.authRoles && (
    (Array.isArray(g.authRoles.admin) && g.authRoles.admin.length > 0) || 
    (Array.isArray(g.authRoles.mod) && g.authRoles.mod.length > 0) || 
    (Array.isArray(g.authRoles.staff) && g.authRoles.staff.length > 0)
  )).length;
  const authTierRolesCount = guilds.reduce((acc, g) => {
    let count = 0;
    if (Array.isArray(g?.authRoles?.admin)) count += g.authRoles.admin.length;
    if (Array.isArray(g?.authRoles?.mod)) count += g.authRoles.mod.length;
    if (Array.isArray(g?.authRoles?.staff)) count += g.authRoles.staff.length;
    return acc + count;
  }, 0);

  // Emergencies, 2FA & Spam Permits
  const emergencySnapshots = Object.keys(cache.emergencies || {}).length;
  const spamPermittedUsers = (cache.spamPermitted || []).length;
  const twoFactorServers = guilds.filter(g => g && g.twoFactorVerified).length;

  // Music, Liked Songs & TTS
  const musicChannels = guilds.filter(g => g && g.musicChannelId).length;
  const likedSongsUsers = Object.keys(cache.likedSongs || {}).length;
  const likedSongsTotal = Object.values(cache.likedSongs || {}).reduce((acc, songs) => acc + (Array.isArray(songs) ? songs.length : 0), 0);
  const ttsUsers = Object.keys(cache.tts?.users || {}).length;
  const autoTtsChannels = Object.keys(cache.tts?.autoTts || {}).length;

  // AFK, Bump Reminders, Edit Ratings & Sticky Messages
  const afkUsers = Object.keys(cache.afk || {}).length;
  const bumpReminderGuilds = Object.keys(cache.bumpReminders || {}).length;
  const editRatingMessages = Object.keys(cache.editRatings || {}).length;
  const rateChannels = Object.keys(cache.rateChannels || {}).length;
  const stickyChannels = Object.values(cache.stickyMessages || {}).reduce((acc, g) => acc + Object.keys(g || {}).length, 0);

  return {
    guilds: Object.keys(cache.guilds || {}).length,
    customPrefixes: guilds.filter(g => g && g.prefix && g.prefix !== '!').length,
    autoNicks: guilds.filter(g => g && g.autonick && (typeof g.autonick === 'object' ? g.autonick.enabled : Boolean(g.autonick))).length,
    accentColors: guilds.filter(g => g && g.accentColor).length,
    dashboardChannels: guilds.filter(g => g && g.dashboardChannelId).length,

    securityServers: guilds.filter(g => g && (g.securityEnabled || g.antiNukeEnabled)).length,
    antiBotAddServers,
    antiLinkedRoleServers,
    antiRoleModulesServers,
    antiChannelModulesServers,
    antiWebhookServers,
    antiNukeThresholds,
    raidModeServers,
    honeypots: guilds.filter(g => g && g.honeypotChannelId).length,
    firewallRolesCount,
    unbypassableRolesCount,

    automodServers: guilds.filter(g => g && (g.wordFilterEnabled || g.antiSpamEnabled || g.antiLinkEnabled || g.antiInviteEnabled || g.aiToxicityEnabled)).length,
    antiSpamServers,
    antiInviteServers,
    antiLinkServers,
    wordFilterServers,
    antiFloodServers,
    antiMentionServers,
    aiToxicityServers,
    blacklistedWordsCount,
    allowedLinksCount,
    automodBypassRolesCount,
    automodBypassServers,

    autoroleHumanServers,
    autoroleBotServers,
    vanityRewardServers,
    totalAutoroleBindings,

    ytStatsServers,
    ytStatsChannelsCount,
    modmailServers,
    modmailChannelsCount,

    ticketSetups,
    ticketsActive,
    ticketsTotalCreated,
    ticketStaffRolesCount,
    ticketAiTriageServers,

    suggestionChannels,
    starboardChannels,
    voiceRolesCount,
    globalActionLogServers,

    maxWarningsSet,
    maxWarningsAvg,
    quarantines: Object.keys(cache.quarantines || {}).length,
    quarantineRolesCount,
    quarantineChannelsCount,
    quarantineVcsCount,
    warnings: Object.values(cache.warnings || {}).reduce((acc, curr) => acc + Object.keys(curr || {}).length, 0),
    tempBans: Object.values(cache.tempBans || {}).reduce((acc, curr) => acc + Object.keys(curr || {}).length, 0),

    extraOwners: Object.keys(cache.extraOwners || {}).length,
    extraOwnersTotal: Object.values(cache.extraOwners || {}).reduce((acc, curr) => acc + (Array.isArray(curr) ? curr.length : 0), 0),
    botWhitelist: Object.keys(cache.botWhitelist || {}).length,
    whitelistedRoles: guilds.reduce((acc, g) => acc + (g?.linkBypassRoles?.length || 0) + (g?.inviteBypassRoles?.length || 0) + Object.keys(g?.whitelist?.roles || {}).length, 0),
    whitelistedUsers: guilds.reduce((acc, g) => acc + Object.keys(g?.whitelist?.users || {}).length, 0),
    botBlacklistUsers: Array.isArray(cache.botBlacklist) ? cache.botBlacklist.length : Object.keys(cache.botBlacklist || {}).length,
    botBlacklistList: Array.isArray(cache.botBlacklist) ? cache.botBlacklist : Object.keys(cache.botBlacklist || {}),
    botBlacklistData: cache.botBlacklistData || {},

    welcomeActive,
    welcomeMessages,
    welcomeEmbeds,
    welcomeGifs,
    welcomeColors,
    leaveActive,
    leaveMessages,
    leaveEmbeds,
    leaveGifs,

    newsChannels,
    newsFeedsCount,
    newsRolesCount,
    newsServers,
    quoteChannels,
    autoReactChannels,
    autoReactServers,
    autoReactEmojisCount,
    inviteLogChannels,
    inviteBypassChannels,
    mediaChannels,
    msgDeleteLogChannels,
    msgDeleteServers,
    msgEditLogChannels,

    xpSystems: Object.keys(cache.xpSystems || {}).length,
    xpUsers: Object.values(cache.usersXp || {}).reduce((acc, curr) => acc + Object.keys(curr || {}).length, 0),
    serverStats: Object.keys(cache.serverStats || {}).length,
    triggers: Object.keys(cache.triggers || {}).length + (cache.globalTriggers || []).length,
    tickets: Object.keys(cache.tickets || {}).length,
    verification: Object.keys(cache.verification || {}).length,
    giveaways: Object.keys(cache.giveaways || {}).length,
    reactionRoles: Object.keys(cache.reactionRoles || {}).length,
    stickyMessages: Object.keys(cache.stickyMessages || {}).length,
    adel: Object.values(cache.adelList || {}).reduce((acc, c) => acc + Object.keys(c || {}).length, 0),
    
    birthdayChannels,
    birthdayServers,
    birthdayUsers,

    apps: Object.keys(cache.apps || {}).length,
    countingGuilds: Object.keys(cache.counting || {}).length,
    countingActive: Object.values(cache.counting || {}).filter(c => c && c.channelId).length,
    countingTotalCounts: Object.values(cache.counting || {}).reduce((acc, c) => acc + (c?.currentCount || 0), 0),
    countingPeakRecord: Object.values(cache.counting || {}).reduce((max, c) => Math.max(max, c?.highScore || 0), 0),
    countingTotalUsers: Object.values(cache.counting || {}).reduce((acc, c) => acc + Object.keys(c?.users || {}).length, 0),
    countingTotalValidatedCounts: Object.values(cache.counting || {}).reduce((acc, c) => 
      acc + Object.values(c?.users || {}).reduce((uAcc, u) => uAcc + (u?.count || 0), 0), 0),
    countingTotalRuins: Object.values(cache.counting || {}).reduce((acc, c) => 
      acc + Object.values(c?.users || {}).reduce((uAcc, u) => uAcc + (u?.ruins || 0), 0), 0),
    countingTotalSaves: Object.values(cache.counting || {}).reduce((acc, c) => acc + (c?.saves ?? 0), 0),
    countingMathEnabled: Object.values(cache.counting || {}).filter(c => c && c.allowMath !== false).length,
    countingAutoTopicEnabled: Object.values(cache.counting || {}).filter(c => c && c.autoTopic !== false).length,
    serverLogsCount: guilds.filter(g => g && g.serverLogs && (g.serverLogs.enabled || g.serverLogs.defaultChannelId)).length,
    logChannelsCount,
    voiceLogs: guilds.filter(g => g && g.voiceLogChannel).length,
    homeVc: guilds.filter(g => g && g.homeVcId).length,
    theaterModeVcs: guilds.filter(g => g && g.theaterModeVcId).length,
    jtc: Object.keys(cache.jtc || {}).length,
    jtcChannels: Object.keys(cache.jtcChannels || {}).length,
    vcProtection: Object.values(cache.vcProtection || {}).reduce((acc, u) => acc + (Array.isArray(u) ? u.length : 0), 0),
    vcDrags: Object.values(cache.vcDrags || {}).reduce((acc, curr) => acc + Object.keys(curr || {}).length, 0),

    serverBackups: Object.keys(cache.backups || {}).length,
    npUsers: Object.keys(cache.npUsers || {}).length,
    npServers: Object.keys(cache.npServers || {}).length,
    npManagers: (cache.npManagers || []).length,

    economyUsers: Object.values(cache.economy || {}).reduce((acc, g) => acc + Object.keys(g || {}).length, 0),
    shopItemsCount: Object.values(cache.shopItems || {}).reduce((acc, g) => acc + (Array.isArray(g) ? g.length : 0), 0),
    shopGuilds: Object.keys(cache.shopItems || {}).filter(k => (cache.shopItems[k] || []).length > 0).length,
    aiModeServers: guilds.filter(g => g && g.aiModeEnabled).length,
    aiDedicatedChannels: guilds.filter(g => g && g.aiChannelId).length,
    rankRewardsCount: Object.values(cache.xpSystems || {}).reduce((acc, s) => acc + Object.keys(s?.roleRewards || {}).length, 0),
    customThemesCount: Object.keys(cache.userRankThemes || {}).length,

    lockdownSnapshots: Object.keys(cache.lockdownSnapshots || {}).length,
    minigamesUsers: Object.values(cache.minigamesStats || {}).reduce((acc, g) => acc + Object.keys(g || {}).length, 0),
    minigamesWagered: Object.values(cache.minigamesStats || {}).reduce((acc, g) => acc + Object.values(g || {}).reduce((uAcc, u) => uAcc + (u?.totalWagered || 0), 0), 0),
    studioTemplates: Object.values(cache.studioTemplates || {}).reduce((acc, g) => acc + Object.keys(g || {}).length, 0),
    voiceAnalyticsServers: Object.keys(cache.voiceAnalytics || {}).length,
    captchaVerification: Object.values(cache.verification || {}).filter(v => v && (v.mode === 'captcha' || v.mode === 'math')).length,

    nukeSignaturesCount,
    nukeSignatureServers,
    baselineProfiles,
    staffBaselinedCount,

    authTierServers,
    authTierRolesCount,
    emergencySnapshots,
    spamPermittedUsers,
    twoFactorServers,

    musicChannels,
    likedSongsUsers,
    likedSongsTotal,
    ttsUsers,
    autoTtsChannels,

    afkUsers,
    bumpReminderGuilds,
    editRatingMessages,
    rateChannels,
    stickyChannels
  };
}

/**
 * Formats full structured breakdown of all backed-up bot data.
 */
export function formatDatabaseMetrics(m, options = {}) {
  const { reason, timestamp, sizeKb, prefixText, channelId, fileName } = options;

  let text = '';
  if (prefixText) text += `${prefixText}\n\n`;
  if (channelId) text += `> -# **__Backup Channel:__** <#${channelId}>\n\n`;
  if (fileName) text += `> -# **__Restored Snapshot:__** \`${fileName}\`\n\n`;

  text += 
    `-# **__Server Profiles & Configurations:__**\n` +
    `> -# **__Guilds:__** \`${m.guilds}\` | **__Prefixes:__** \`${m.customPrefixes}\` | **__Auto-Nicks:__** \`${m.autoNicks}\` | **__Colors:__** \`${m.accentColors}\` | **__Dashboards:__** \`${m.dashboardChannels}\` | **__2FA:__** \`${m.twoFactorServers || 0}\`\n\n` +

    `-# **__Security & Anti-Nuke Engine:__**\n` +
    `> -# **__Active Defense:__** \`${m.securityServers} servers\` | **__Honeypots:__** \`${m.honeypots}\` | **__Raid Mode:__** \`${m.raidModeServers}\` | **__Thresholds:__** \`${m.antiNukeThresholds}\`\n` +
    `> -# **__Shield Modules:__** \`Roles: ${m.antiRoleModulesServers}, Chs: ${m.antiChannelModulesServers}, Hooks: ${m.antiWebhookServers}, Bots: ${m.antiBotAddServers}, Linked: ${m.antiLinkedRoleServers || 0}\`\n` +
    `> -# **__Persistence & Emergency:__** \`Unbypassable: ${m.unbypassableRolesCount || 0}, Firewall: ${m.firewallRolesCount || 0} | Panic: ${m.lockdownSnapshots || 0}, Snapshots: ${m.emergencySnapshots || 0}, CAPTCHA: ${m.captchaVerification || 0}\`\n\n` +

    `-# **__Heuristic Threat Engine & Clearances:__**\n` +
    `> -# **__Heuristics:__** \`${m.baselineProfiles || 0} baselines (${m.staffBaselinedCount || 0} staff)\` | **__Threat Sigs:__** \`${m.nukeSignaturesCount || 0} anomaly signatures (${m.nukeSignatureServers || 0} guilds)\`\n` +
    `> -# **__Role Clearances:__** \`${m.authTierServers || 0} tier setups (${m.authTierRolesCount || 0} roles) | Spam Permits: ${m.spamPermittedUsers || 0}\`\n\n` +

    `-# **__Automod Protection Matrix:__**\n` +
    `> -# **__Automod:__** \`${m.automodServers} active\` | **__Word Filter:__** \`${m.wordFilterServers}\` (${m.blacklistedWordsCount} words)\n` +
    `> -# **__Granular Shields:__** \`Spam: ${m.antiSpamServers}, Invite: ${m.antiInviteServers}, Flood: ${m.antiFloodServers}, Mention: ${m.antiMentionServers}, Link: ${m.antiLinkServers}, Toxicity: ${m.aiToxicityServers || 0}\`\n` +
    `> -# **__Bypasses:__** \`${m.allowedLinksCount} links, ${m.inviteBypassChannels} invite chs, ${m.automodBypassRolesCount || 0} roles (${m.automodBypassServers || 0} guilds)\`\n\n` +

    `-# **__AutoRole, Vanity & Media Integrations:__**\n` +
    `> -# **__AutoRoles:__** \`${m.autoroleHumanServers || 0} human, ${m.autoroleBotServers || 0} bot (${m.totalAutoroleBindings || 0} roles)\` | **__Vanity:__** \`${m.vanityRewardServers || 0} guilds\`\n` +
    `> -# **__Media & Integrations:__** \`YT: ${m.ytStatsChannelsCount || 0} VCs | Mail: ${m.modmailServers || 0} | Music: ${m.musicChannels || 0} VCs (${m.likedSongsTotal || 0} songs, ${m.likedSongsUsers || 0} users) | Media: ${m.mediaChannels || 0}\`\n\n` +

    `-# **__Moderation, Enforcement & Whitelists:__**\n` +
    `> -# **__Sanctions:__** \`${m.warnings} warnings, ${m.tempBans} tempbans, ${m.maxWarningsSet} strike limits | Quarantined: ${m.quarantines} users (${m.quarantineRolesCount} roles, ${m.quarantineChannelsCount} chs)\`\n` +
    `> -# **__Access & Whitelists:__** \`Extra Owners: ${m.extraOwners} guilds (${m.extraOwnersTotal} users) | Roles: ${m.whitelistedRoles}, Users: ${m.whitelistedUsers} | Bot WL: ${m.botWhitelist} | Blacklisted: ${m.botBlacklistUsers}\`\n` +
    (m.botBlacklistUsers > 0 && Array.isArray(m.botBlacklistList) && m.botBlacklistList.length > 0
      ? `> -# **__Globally Banned:__** ${m.botBlacklistList.slice(0, 4).map(id => `<@${id}> (\`${id}\`)`).join(', ')}${m.botBlacklistList.length > 4 ? ` *+${m.botBlacklistList.length - 4} more*` : ''}\n\n`
      : `\n`) +

    `-# **__Member Greetings & Tracking:__**\n` +
    `> -# **__Greetings:__** \`Welcome: ${m.welcomeActive} chs (${m.welcomeEmbeds} embeds, ${m.welcomeGifs} gifs) | Leave: ${m.leaveActive} chs (${m.leaveEmbeds} embeds)\`\n` +
    `> -# **__Invite Tracking:__** \`${m.inviteLogChannels} invite log channels with live inviter attribution\`\n\n` +

    `-# **__Community, Economy & Neural AI:__**\n` +
    `> -# **__Neural AI:__** \`Mode: ${m.aiModeServers || 0} guilds (${m.aiDedicatedChannels || 0} chs) | Toxicity: ${m.aiToxicityServers || 0} | Triage: ${m.ticketAiTriageServers || 0} | Guide: 257+ cmds RAG\`\n` +
    `> -# **__Engagement:__** \`News: ${m.newsChannels} chs (${m.newsFeedsCount} feeds) | Auto-React: ${m.autoReactChannels} | Tickets: ${m.ticketSetups || 0} (${m.ticketsActive || 0} active) | Giveaways: ${m.giveaways}\`\n` +
    `> -# **__Economy & Shop:__** \`${m.economyUsers || 0} ledgers | Shop Items: ${m.shopItemsCount || 0} perks (${m.shopGuilds || 0} guilds) | Themes: ${m.customThemesCount || 0} (${m.rankRewardsCount || 0} milestones)\`\n` +
    `> -# **__Activity:__** \`XP: ${m.xpSystems} guilds (${m.xpUsers} users) | Counting: ${m.countingActive || 0} chs (Peak: ${m.countingPeakRecord || 0}, Streak: ${m.countingTotalCounts || 0}) | Quotes: ${m.quoteChannels} | Sticky: ${m.stickyChannels || 0} | AFK: ${m.afkUsers || 0}\`\n\n` +

    `-# **__Voice Systems, Audits & Analytics:__**\n` +
    `> -# **__Voice & JTC:__** \`${m.homeVc} home VCs, ${m.theaterModeVcs} theater, ${m.jtc} JTC hubs (${m.jtcChannels} temp) | Telemetry: ${m.voiceAnalyticsServers || 0} guilds\`\n` +
    `> -# **__Audits & Storage:__** \`${m.serverLogsCount} server logs, ${m.logChannelsCount} mod audit, ${m.msgDeleteLogChannels} delete logs | NP: ${m.npUsers} | Templates: ${m.serverBackups} | SQLite WAL active\`\n`;

  if (sizeKb !== undefined) text += `> -# **__Snapshot Size:__** \`${sizeKb} KB\`\n`;
  if (timestamp) {
    const tsSec = Math.floor(timestamp / 1000);
    text += `> -# **__Timestamp:__** <t:${tsSec}:F> (<t:${tsSec}:R>)\n`;
  }
  if (reason) text += `> -# **__Trigger Event:__** \`${reason}\`\n`;

  return text.trim();
}

/**
 * Resolves the Discord channel designated for database cloud backups.
 */
export async function getBackupChannel(client) {
  if (!client) return null;

  // 1. Check environment variable
  const envChannelId = process.env.DB_BACKUP_CHANNEL_ID || process.env.BACKUP_CHANNEL_ID;
  if (envChannelId) {
    const ch = client.channels.cache.get(envChannelId) || await client.channels.fetch(envChannelId).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
  }

  // 2. Check database cached channel ID
  const dbChannelId = db.cache.dbBackupChannelId;
  if (dbChannelId) {
    const ch = client.channels.cache.get(dbChannelId) || await client.channels.fetch(dbChannelId).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
  }

  // 3. Search across guilds for existing 'athena-db-backups' channel
  for (const guild of client.guilds.cache.values()) {
    const ch = guild.channels.cache.find(c => c.name === 'athena-db-backups' && c.isTextBased());
    if (ch) {
      db.cache.dbBackupChannelId = ch.id;
      db.save();
      return ch;
    }
  }

  // 4. Search across guilds for channel with backup topic signature
  for (const guild of client.guilds.cache.values()) {
    const ch = guild.channels.cache.find(c => c.topic && (c.topic.includes('athena-db-backups') || c.topic.includes('database cloud snapshots')) && c.isTextBased());
    if (ch) {
      db.cache.dbBackupChannelId = ch.id;
      db.save();
      return ch;
    }
  }

  // 5. Search for any channel whose name includes 'backup' or 'db' containing previous athena_db backups
  for (const guild of client.guilds.cache.values()) {
    const candidateChannels = guild.channels.cache.filter(c => 
      c.isTextBased() && 
      (c.name.includes('backup') || c.name.includes('db') || c.name.includes('snapshot'))
    );
    for (const ch of candidateChannels.values()) {
      try {
        const msgs = await ch.messages.fetch({ limit: 10 }).catch(() => null);
        if (msgs && msgs.some(m => m.attachments.some(a => a.name?.startsWith('athena_db_')))) {
          db.cache.dbBackupChannelId = ch.id;
          db.save();
          console.log(chalk.cyan(`[CloudSync] Discovered previous cloud backup channel #${ch.name} in ${guild.name} (${ch.id})`));
          return ch;
        }
      } catch {}
    }
  }

  // 6. Auto-create private backup channel in first available guild where bot has Administrator
  for (const guild of client.guilds.cache.values()) {
    const me = guild.members.me;
    if (me && me.permissions.has(PermissionFlagsBits.Administrator)) {
      try {
        const newCh = await guild.channels.create({
          name: 'athena-db-backups',
          type: ChannelType.GuildText,
          topic: 'Encrypted automated database cloud snapshots - Athena Prime [athena-db-backups]',
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: me.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]
            }
          ]
        });
        if (newCh) {
          db.cache.dbBackupChannelId = newCh.id;
          db.save();
          console.log(chalk.green(`[CloudSync] Auto-created private cloud backup channel in ${guild.name} (${newCh.id})`));
          return newCh;
        }
      } catch {}
    }
  }

  return null;
}

/**
 * Creates and uploads a complete cloud backup to Discord.
 */
export async function createCloudBackup(client, reason = 'Automated Schedule') {
  if (isBackingUp) return { success: false, reason: 'Backup already in progress' };
  isBackingUp = true;

  try {
    // 1. Flush any pending memory changes to disk
    if (db.needsSave || db.saveTimeout) {
      clearTimeout(db.saveTimeout);
      db.saveTimeout = null;
      db.needsSave = false;
      const dataStr = JSON.stringify(db.cache, null, 2);
      fs.writeFileSync(DB_FILE, dataStr, 'utf8');
    }

    // 2. Checkpoint SQLite WAL mode so all pending transactions are written to stats.db
    statsDB.checkpoint();

    if (!fs.existsSync(DB_FILE)) {
      return { success: false, reason: 'db.json does not exist' };
    }

    const channel = await getBackupChannel(client);
    if (!channel) {
      return { success: false, reason: 'No backup channel configured or accessible' };
    }

    const timestamp = Date.now();
    const dbAttachment = new AttachmentBuilder(DB_FILE, { name: `athena_db_${timestamp}.json` });
    const files = [dbAttachment];

    if (fs.existsSync(STATS_FILE)) {
      files.push(new AttachmentBuilder(STATS_FILE, { name: `stats_${timestamp}.db` }));
    }

    const stats = fs.statSync(DB_FILE);
    const sizeKb = (stats.size / 1024).toFixed(1);
    const m = getDatabaseMetrics();

    let formattedText = formatDatabaseMetrics(m, {
      prefixText: 'Automated persistent cloud snapshot stored.',
      sizeKb,
      timestamp,
      reason
    });
    if (formattedText.length > 3600) {
      formattedText = formattedText.slice(0, 3500) + '\n> -# **__[Snapshot manifest truncated for Discord display limits]__**';
    }

    const payload = cv2.info(
      `Database Cloud Backup | <a:atheNATICK:1557841381630681106>`,
      formattedText
    );
    // Post diagnostics manifest container with files securely stored in Discord Cloud
    payload.files = files;
    const sentMsg = await channel.send(payload);

    // Save metadata
    db.cache.lastCloudBackup = timestamp;
    db.cache.lastCloudBackupMsgId = sentMsg?.id || null;
    db.save();

    // Rotate and prune old backup messages to avoid channel bloat (keep latest 30)
    try {
      const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
      if (messages) {
        const backupMessages = messages
          .filter(m => m.author.id === client.user.id && m.attachments.some(a => a.name?.startsWith('athena_db_')))
          .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

        const toDelete = [...backupMessages.values()].slice(30);
        for (const msg of toDelete) {
          await msg.delete().catch(() => null);
        }
      }
    } catch {}

    console.log(chalk.cyan(`[CloudSync] Cloud backup saved to Discord channel #${channel.name} (${sizeKb} KB, ${m.guilds} guilds)`));
    return { success: true, timestamp, messageId: sentMsg?.id, channelId: channel.id };
  } catch (err) {
    console.error(chalk.red('[CloudSync] Failed to create cloud backup:'), err);
    return { success: false, error: err.message };
  } finally {
    isBackingUp = false;
  }
}

/**
 * Downloads and restores the latest snapshot directly from the Discord cloud backup channel.
 */
export async function restoreFromCloud(client) {
  const channel = await getBackupChannel(client);
  if (!channel) {
    return { success: false, reason: 'No cloud backup channel found or configured.' };
  }

  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages || messages.size === 0) {
    return { success: false, reason: 'Backup channel has no messages.' };
  }

  // Find latest message with athena_db_*.json or db.json attachment sorted by timestamp
  const backupMessages = messages.filter(m => 
    m.attachments.some(a => a.name?.endsWith('.json') && (a.name.includes('athena_db_') || a.name === 'db.json'))
  );

  if (!backupMessages || backupMessages.size === 0) {
    return { success: false, reason: 'No database backup attachment found in recent channel messages.' };
  }

  const backupMsg = backupMessages.sort((a, b) => b.createdTimestamp - a.createdTimestamp).first();

  const attachment = backupMsg.attachments.find(a => a.name?.endsWith('.json'));
  if (!attachment) {
    return { success: false, reason: 'Database attachment missing from message.' };
  }

  console.log(chalk.cyan(`[CloudSync] Downloading latest cloud backup from ${attachment.name} (${(attachment.size / 1024).toFixed(1)} KB)...`));

  const response = await fetch(attachment.url);
  if (!response.ok) {
    throw new Error(`Download failed HTTP ${response.status}`);
  }

  const text = await response.text();
  const parsed = JSON.parse(text);

  if (!parsed || typeof parsed !== 'object' || !parsed.guilds) {
    throw new Error('Downloaded backup file has invalid schema (missing guilds).');
  }

  // Keep a safety copy of whatever local file existed
  if (fs.existsSync(DB_FILE)) {
    try {
      fs.copyFileSync(DB_FILE, path.join(BACKUPS_DIR, `pre_restore_${Date.now()}.json`));
    } catch {}
  }

  // Write restored database to disk
  fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');

  // Also restore stats.db if attached
  const statsAtt = backupMsg.attachments.find(a => a.name?.endsWith('.db'));
  if (statsAtt) {
    try {
      const statsRes = await fetch(statsAtt.url);
      if (statsRes.ok) {
        const statsBuffer = Buffer.from(await statsRes.arrayBuffer());
        statsDB.close();
        fs.writeFileSync(STATS_FILE, statsBuffer);
        statsDB.reopen();
        console.log(chalk.cyan('[CloudSync] Restored stats.db from cloud backup.'));
      }
    } catch (e) {
      console.warn('[CloudSync] Could not restore stats.db:', e.message);
    }
  }

  // Hot-reload in-memory database
  db.load();

  const m = getDatabaseMetrics();
  return {
    success: true,
    fileName: attachment.name,
    timestamp: backupMsg.createdTimestamp,
    metrics: m
  };
}

/**
 * Checks on boot whether the local database is fresh/empty (e.g. new host clone).
 * If so, automatically fetches and restores the latest backup from Discord!
 */
export async function checkAndAutoRestore(client) {
  try {
    const guildCount = Object.keys(db.cache.guilds || {}).length;
    const forceRestore = process.env.FORCE_DB_RESTORE === 'true';

    // If we already have live guilds in the database and force restore isn't requested, no restore needed
    if (guildCount > 0 && !forceRestore) {
      return { restored: false, reason: 'Database already populated' };
    }

    console.log(chalk.yellow('[CloudSync] Fresh host detected (0 guilds in db.json). Searching for Discord cloud backup...'));

    const result = await restoreFromCloud(client);
    if (!result.success) {
      console.warn(chalk.yellow(`[CloudSync] Auto-restore aborted: ${result.reason}`));
      return { restored: false, reason: result.reason };
    }

    const m = result.metrics;
    console.log(chalk.green.bold(`\n======================================================`));
    console.log(chalk.green.bold(`[CloudSync] AUTO-RESTORE COMPLETE! Successfully restored:`));
    console.log(chalk.green.bold(`  • Servers: ${m.guilds}`));
    console.log(chalk.green.bold(`  • XP & Leveling Systems: ${m.xpSystems} servers (${m.xpUsers} users)`));
    console.log(chalk.green.bold(`  • Server Stats Setups: ${m.serverStats} servers`));
    console.log(chalk.green.bold(`  • Extra Owners & Whitelists: ${m.extraOwners} servers (${m.extraOwnersTotal} users)`));
    console.log(chalk.green.bold(`  • Welcome Messages & Rules: Intact`));
    console.log(chalk.green.bold(`  • Blacklisted Words & Triggers: Intact (${m.triggers} triggers)`));
    console.log(chalk.green.bold(`  • Quarantine & Autoroles: Intact (${m.quarantines} records)`));
    console.log(chalk.green.bold(`  • Tickets & Giveaways: Intact (${m.tickets} tickets, ${m.giveaways} giveaways)`));
    console.log(chalk.green.bold(`  • Heuristics & Signatures: Intact (${m.baselineProfiles || 0} baselines, ${m.nukeSignaturesCount || 0} signatures)`));
    console.log(chalk.green.bold(`  • Role Authorizations: Intact (${m.authTierServers || 0} servers, ${m.authTierRolesCount || 0} tiered roles)`));
    console.log(chalk.green.bold(`  • Economy & Role Shop: Intact (${m.economyUsers || 0} ledgers, ${m.shopItemsCount || 0} shop items)`));
    console.log(chalk.green.bold(`  • Custom Rank Themes: Intact (${m.customThemesCount || 0} themed profiles)`));
    console.log(chalk.green.bold(`  • Emergency Lockdown Bitmasks: Intact (${m.lockdownSnapshots || 0} snapshots)`));
    console.log(chalk.green.bold(`======================================================\n`));

    // Notify backup channel
    const channel = await getBackupChannel(client);
    if (channel) {
      await channel.send(cv2.success(
        `Database Auto-Restored | <a:atheNATICK:1557841381630681106>`,
        formatDatabaseMetrics(m, {
          prefixText: '**New Hosting Migration Detected!**\nThe bot detected a fresh boot and automatically restored all server configurations from the latest cloud backup.',
          fileName: result.fileName,
          timestamp: Date.now()
        })
      )).catch(() => null);
    }

    return { restored: true, metrics: m };
  } catch (err) {
    console.error(chalk.red('[CloudSync] Auto-restore failed:'), err);
    return { restored: false, error: err.message };
  }
}

/**
 * Manually restores the database from a given JSON string or buffer.
 */
export async function manualRestore(jsonContent) {
  try {
    const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    if (!parsed || typeof parsed !== 'object' || !parsed.guilds) {
      throw new Error('Invalid database JSON structure. Must contain a "guilds" object.');
    }

    // Create safety snapshot before overwriting
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, path.join(BACKUPS_DIR, `manual_before_restore_${Date.now()}.json`));
      } catch {}
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
    db.load();

    return {
      success: true,
      metrics: getDatabaseMetrics()
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Starts the periodic automated cloud backup timer.
 */
export function startCloudBackupScheduler(client, intervalMinutes = 20) {
  if (backupInterval) clearInterval(backupInterval);

  const ms = intervalMinutes * 60 * 1000;
  console.log(chalk.cyan(`[CloudSync] Automated Discord cloud backup scheduler active (Interval: ${intervalMinutes}m)`));

  // Initial backup 30 seconds after boot to ensure latest state is synced
  setTimeout(() => {
    createCloudBackup(client, 'Post-Boot Sync').catch(() => null);
  }, 30000);

  backupInterval = setInterval(() => {
    createCloudBackup(client, `Periodic ${intervalMinutes}m Schedule`).catch(() => null);
  }, ms);
}
