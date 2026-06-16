import { REST, Routes, ActivityType } from 'discord.js';
import chalk from 'chalk';
import { allCommands } from '../commands/loader.js';
import db from '../database.js';
import { connectToHomeVc, updateBotVcStatus } from '../utils/voice.js';
import { ensureUnbypassableRole } from '../utils/antiStrip.js';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    // Beautiful colored console log
    console.log(chalk.hex('#FFD700').bold(`🚀 SUCCESS: Connected to Discord Gateway!`));
    console.log(chalk.cyan(`🤖 Logged in as: ${chalk.bold(client.user.tag)} (ID: ${client.user.id})`));
    console.log(chalk.yellow(`📈 Watching ${client.guilds.cache.size} server(s)...`));

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
    const statuses = [
      'Athena Prime | Armed',
      'Athena Prime | Secured',
      'Athena Prime | Truly Unbypassable'
    ];
    let statusIndex = 0;

    // Initial status
    client.user.setPresence({
      activities: [{ name: statuses[0], type: ActivityType.Watching }],
      status: 'online'
    });

    // Rotate every 15 seconds
    setInterval(() => {
      statusIndex = (statusIndex + 1) % statuses.length;
      client.user.setPresence({
        activities: [{ name: statuses[statusIndex], type: ActivityType.Watching }],
        status: 'online'
      });
    }, 15000);

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

    // Sync slash commands globally
    try {
      console.log(chalk.blue('⏳ Syncing slash commands globally...'));

      const slashData = allCommands
        .filter(cmd => !cmd.hidden) // Skip hidden commands (e.g., enuke — prefix only)
        .map(cmd => {
          // Map options and build proper REST format
          return {
            name: cmd.name,
            description: cmd.description,
            options: cmd.options || [],
            // Convert bigint permissions to string format for REST API
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
