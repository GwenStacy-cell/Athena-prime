import { REST, Routes, ActivityType } from 'discord.js';
import chalk from 'chalk';
import { allCommands } from '../commands/loader.js';
import db from '../database.js';
import { connectToHomeVc, updateBotVcStatus } from '../utils/voice.js';
import { ensureUnbypassableRole } from '../utils/antiStrip.js';
import { CronJob } from 'cron';
import { generateBirthdayMessage } from '../commands/birthday.js';
import statsDB from '../statsDB.js';
import { endGiveaway } from '../commands/giveaway.js';
import { setupDashboardChannel, updateDashboardMessage } from '../utils/dashboardManager.js';
import { startNewsJob } from '../jobs/newsJob.js';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    // Beautiful colored console log
    console.log(chalk.hex('#FFD700').bold(`🚀 SUCCESS: Connected to Discord Gateway!`));
    console.log(chalk.cyan(`🤖 Logged in as: ${chalk.bold(client.user.tag)} (ID: ${client.user.id})`));
    console.log(chalk.yellow(`📈 Watching ${client.guilds.cache.size} server(s)...`));

    // Daily Midnight IST Cron Job (00:00)
    new CronJob('0 0 * * *', async () => {
      try {
        // Prune old stats data
        statsDB.pruneOldStats();

        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const currentDay = now.getDate();
        const currentMonth = now.getMonth() + 1;

        console.log(chalk.magenta(`🎉 Checking birthdays for ${currentDay}/${currentMonth} (IST)...`));

        const birthdayConfigs = db.cache.birthdays || {};
        for (const [guildId, config] of Object.entries(birthdayConfigs)) {
          if (!config.channelId || !config.users) continue;
          
          const guild = client.guilds.cache.get(guildId);
          if (!guild) continue;
          
          const channel = guild.channels.cache.get(config.channelId);
          if (!channel) continue;

          for (const [userId, dates] of Object.entries(config.users)) {
            if (dates.day === currentDay && dates.month === currentMonth) {
              const message = generateBirthdayMessage(userId, guildId);
              await channel.send(message).catch(() => null);
            }
          }
        }
      } catch (err) {
        console.error(chalk.red('❌ Error running birthday cron job:'), err);
      }
    }, null, true, 'Asia/Kolkata');

    // Giveaway Timer (Runs every 15 seconds)
    setInterval(async () => {
      const activeGiveaways = db.getActiveGiveaways();
      for (const gw of activeGiveaways) {
        if (!gw.ended && gw.endsAt <= Date.now()) {
          console.log(chalk.blue(`⏳ Automatically ending giveaway: ${gw.messageId}`));
          await endGiveaway(client, gw.messageId, gw);
        }
      }
    }, 15000);

    // Bump Reminder Timer (Runs every 60 seconds)
    setInterval(async () => {
      const reminders = db.getBumpReminders();
      for (const [guildId, data] of Object.entries(reminders)) {
        if (data.expiresAt <= Date.now()) {
          db.deleteBumpReminder(guildId);
          
          const guild = client.guilds.cache.get(guildId);
          if (!guild) continue;
          const channel = guild.channels.cache.get(data.channelId);
          if (!channel) continue;
          
          const cfg = db.getGuildConfig(guildId) || {};
          const owner = await client.users.fetch(data.ownerId).catch(() => null);
          const bumper = data.bumperId ? await client.users.fetch(data.bumperId).catch(() => null) : null;
          
          const embedData = {
            title: 'BUMP AVAILABLE',
            description: `It has been 2 hours since the last bump! Please use the \`/bump\` command to bump **${guild.name}** again and help the server grow.`,
            color: cfg.accentColor || '#00e5ff',
            footer: { text: 'Athena Prime Automations' },
            timestamp: new Date()
          };

          const pings = [];
          
          if (cfg.bumpRoleIds && Array.isArray(cfg.bumpRoleIds)) {
            cfg.bumpRoleIds.forEach(id => pings.push(`<@&${id}>`));
          } else if (cfg.bumpRoleId) {
            // Fallback for old schema
            pings.push(`<@&${cfg.bumpRoleId}>`);
          }

          if (bumper) pings.push(`<@${bumper.id}>`);
          const pingText = pings.length > 0 ? pings.join(' ') : (owner ? `<@${owner.id}>` : '');

          // Send to channel
          await channel.send({ content: pingText, embeds: [embedData] }).catch(() => null);
          
          // DM the server owner
          if (owner) {
            await owner.send({ content: pingText, embeds: [embedData] }).catch(() => null);
          }
        }
      }
    }, 60000);

    // Store boot timestamp for uptime tracking
    client.bootTimestamp = Date.now();

    // Cache the developer so their mention always resolves correctly in embeds
    client.users.fetch('1423292960744804383').catch(() => null);

    // Auto-join Home VCs and ensure Unbypassable Role across all watching guilds
    client.guilds.cache.forEach(guild => {
      // Unbypassable Role
      ensureUnbypassableRole(guild).catch(() => null);

      // Home VC
      const config = db.getGuildConfig(guild.id);
      if (config.homeVcId) {
        console.log(chalk.blue(`⏳ Auto-connecting to Home VC for guild: ${guild.name}`));
        connectToHomeVc(guild, config.homeVcId);
      }
    });

    // Set custom rich activity presence
    const watchingStatuses = [
      'Athena Prime | Armed',
      'Athena Prime | Secured',
      'Athena Prime | Truly Unbypassable',
      'Athena Prime | Dev Prince'
    ];
    let statusIndex = 0;

    // Initial status
    client.user.setPresence({
      activities: [
        { name: 'status', type: ActivityType.Custom, state: 'Truly Unbypassable' },
        { name: watchingStatuses[0], type: ActivityType.Watching }
      ],
      status: 'online'
    });

    // Rotate Activity every 15 seconds
    setInterval(() => {
      statusIndex = (statusIndex + 1) % watchingStatuses.length;
      client.user.setPresence({
        activities: [
          { name: 'status', type: ActivityType.Custom, state: 'Truly Unbypassable' },
          { name: watchingStatuses[statusIndex], type: ActivityType.Watching }
        ],
        status: 'online'
      });
    }, 15000);

    // Rotate Server Nickname every 30 minutes
    const nicknameSuffixes = [
      'Armed',
      'Dev Prince',
      'Unbypassable',
      'Secured'
    ];
    let nicknameIndex = 0;

    const rotateNickname = async () => {
      nicknameIndex = (nicknameIndex + 1) % nicknameSuffixes.length;
      const currentSuffix = nicknameSuffixes[nicknameIndex];

      // Use a standard for loop to avoid overwhelming the API and cache simultaneously
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          const me = guild.members.me;
          if (!me) continue;

          // Safely determine base name without permanent shrinkage
          let baseName = client.user.username;
          
          if (me.nickname) {
            if (me.nickname.includes(' | ')) {
              let extracted = me.nickname.split(' | ')[0].trim();
              if (client.user.username.startsWith(extracted)) {
                baseName = client.user.username;
              } else {
                baseName = extracted;
              }
            } else {
              baseName = me.nickname;
            }
          }

          // Truncate base name if it's too long (Discord max is 32 chars)
          const maxBaseLength = 32 - (` | ${currentSuffix}`.length);
          if (baseName.length > maxBaseLength) {
            baseName = baseName.substring(0, maxBaseLength).trim();
          }

          const newNickname = `${baseName} | ${currentSuffix}`;
          
          // Only update if it actually changed
          if (me.nickname !== newNickname) {
            await me.setNickname(newNickname).catch(() => null);
          }
        } catch (err) {
          // Ignore individual guild failures (e.g. Missing Permissions)
        }
      }
    };

    rotateNickname(); // Run instantly on boot
    setInterval(rotateNickname, 10 * 60 * 1000); // Then every 10 minutes



    // Global rotating schedule for Voice Channel Statuses
    setInterval(() => {
      client.guilds.cache.forEach(guild => {
        const conf = db.getGuildConfig(guild.id);
        if (conf?.homeVcId) {
          const homeChannel = guild.channels.cache.get(conf.homeVcId);
          if (homeChannel) {
            updateBotVcStatus(homeChannel);
          }
        }
      });
    }, 240000); // Every 4 minutes

    // Server Stats auto-update loop (runs every 6 minutes to stay under Discord rate limits)
    setInterval(async () => {
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          const stats = db.getServerStats(guildId);
          if (!stats) continue;

          // For accurate bot count, we check the cache. 
          // Bots are typically fully cached.
          const total = guild.memberCount;
          const bots = guild.members.cache.filter(member => member.user.bot).size;
          const humans = total - bots;

          const totalCh = guild.channels.cache.get(stats.totalId);
          const humansCh = guild.channels.cache.get(stats.humansId);
          const botsCh = guild.channels.cache.get(stats.botsId);

          if (totalCh && totalCh.name !== `❗・USERS: ${total}`) {
            await totalCh.setName(`❗・USERS: ${total}`).catch(() => null);
          }
          if (humansCh && humansCh.name !== `❗・MEMBERS: ${humans}`) {
            await humansCh.setName(`❗・MEMBERS: ${humans}`).catch(() => null);
          }
          if (botsCh && botsCh.name !== `❗・BOTS: ${bots}`) {
            await botsCh.setName(`❗・BOTS: ${bots}`).catch(() => null);
          }
        } catch (e) {
          // Ignore API errors
        }
      }
    }, 6 * 60 * 1000); // 6 minutes

    // Sync slash commands globally
    try {
      console.log(chalk.blue('⏳ Fetching and caching invites...'));
      client.invites = new Map();
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          const invites = await guild.invites.fetch().catch(() => null);
          if (invites) {
            client.invites.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
          } else {
            client.invites.set(guild.id, new Map());
          }
        } catch (e) {
          // ignore missing permissions
        }
      }
      console.log(chalk.green('✅ Invite cache initialized.'));

    // Start the News Feed Cron Job
    console.log(chalk.blue('⏳ Initializing News Feed Job...'));
    startNewsJob(client);

    // Periodically update JTC panels every 5 minutes to keep stats fresh
    setInterval(async () => {
      for (const [guildId, config] of Object.entries(db.cache.jtc)) {
        if (!config.lobbyChannelId) continue;
        const guild = client.guilds.cache.get(guildId);
        if (guild) await buildSharedPanel(guild);
      }
    }, 5 * 60 * 1000);

    try {
      const db = (await import('./database.js')).default;
      const protectedGuildIds = Object.keys(db.cache.moveProtection || {});
      
      client.auditLogCounts = new Map();
      let cachedCount = 0;
      
      for (const guildId of protectedGuildIds) {
        if (db.cache.moveProtection[guildId].length > 0) {
          const guild = client.guilds.cache.get(guildId);
          if (guild) {
            const auditLogs = await guild.fetchAuditLogs({ limit: 10, type: 26 }).catch(() => null); // 26 = MemberMove
            if (auditLogs) {
              auditLogs.entries.forEach(e => {
                client.auditLogCounts.set(e.id, e.extra?.count || 1);
                cachedCount++;
              });
            }
          }
        }
      }
      if (cachedCount > 0) {
        console.log(`✅ Pre-cached ${cachedCount} MemberMove audit logs for Move Protection.`);
      }
    } catch (e) {
      console.error('Failed to pre-cache audit logs:', e);
    }

    // =====================================
    // SECURITY DASHBOARD INITIALIZATION
    // =====================================
    (async () => {
      for (const guild of client.guilds.cache.values()) {
        const cfg = db.getGuildConfig(guild.id);
        if (cfg.antiNukeEnabled) {
          try {
            await setupDashboardChannel(guild, client);
          } catch (e) {
            console.error(`Failed to setup dashboard for ${guild.id}:`, e);
          }
        }
      }
    })();

    // Update dashboards every 3 minutes
    setInterval(async () => {
      for (const guild of client.guilds.cache.values()) {
        const cfg = db.getGuildConfig(guild.id);
        if (cfg.antiNukeEnabled && cfg.dashboardChannelId) {
          await updateDashboardMessage(guild, client);
        }
      }
    }, 3 * 60 * 1000);

      console.log(chalk.blue('⏳ Updating permissions for existing stats channels...'));
      try {
        for (const guild of client.guilds.cache.values()) {
          const cfg = db.getGuildConfig(guild.id);
          if (cfg.statsChannelId) {
            const ch = guild.channels.cache.get(cfg.statsChannelId);
            if (ch) {
              await ch.permissionOverwrites.edit(guild.roles.everyone.id, {
                UseApplicationCommands: true
              }).catch(() => null);
            }
          }
        }
      } catch (err) {
        console.error('Error updating existing stats channels:', err);
      }

      console.log(chalk.blue('⏳ Syncing slash commands globally...'));

      const slashData = allCommands
        .filter(cmd => !cmd.hidden) // Skip hidden commands (e.g., enuke — prefix only)
        .map(cmd => {
          // Map options and build proper REST format
          if (cmd.slashDef && typeof cmd.slashDef.toJSON === 'function') {
            return cmd.slashDef.toJSON();
          }
          
          return {
            name: cmd.name,
            description: cmd.description,
            options: cmd.options || [],
            default_member_permissions: cmd.permissions && cmd.permissions.length > 0 
              ? cmd.permissions.reduce((acc, perm) => acc | perm, 0n).toString() 
              : null
          };
        });

      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || client.token);

      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: slashData }
      );

      console.log(chalk.hex('#FFD700').bold(`✅ Successfully synced all ${slashData.length} Slash Commands with Discord Gateway.`));
      console.log(chalk.hex('#FFD700').bold('\n============================================='));
      console.log(chalk.hex('#FFD700').bold('🛡️  Athena Prime — God Level Security  🛡️'));
      console.log(chalk.hex('#FFD700').bold('=============================================\n'));
    } catch (error) {
      console.error(chalk.red('❌ Error registering Slash Commands:'), error);
    }
  }
};
