import { REST, Routes, ActivityType } from 'discord.js';
import chalk from 'chalk';
import { allCommands } from '../commands/loader.js';
import db from '../database.js';
import { connectToHomeVc } from '../utils/voice.js';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    // Beautiful colored console log
    console.log(chalk.green.bold(`🚀 SUCCESS: Connected to Discord Gateway!`));
    console.log(chalk.cyan(`🤖 Logged in as: ${chalk.bold(client.user.tag)} (ID: ${client.user.id})`));
    console.log(chalk.yellow(`📈 Watching ${client.guilds.cache.size} server(s)...`));

    // Auto-join Home VCs across all watching guilds
    client.guilds.cache.forEach(guild => {
      const config = db.getGuildConfig(guild.id);
      if (config.homeVcId) {
        console.log(chalk.blue(`⏳ Auto-connecting to Home VC for guild: ${guild.name}`));
        connectToHomeVc(guild, config.homeVcId);
      }
    });

    // Set custom rich activity presence
    client.user.setPresence({
      activities: [{ name: '🛡️ Server Security | !help', type: ActivityType.Watching }],
      status: 'dnd' // Do Not Disturb looks professional and serious for a security bot
    });

    // Sync slash commands globally
    try {
      console.log(chalk.blue('⏳ Syncing slash commands globally...'));

      const slashData = allCommands.map(cmd => {
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

      console.log(chalk.green.bold(`✅ Successfully synced all ${slashData.length} Slash Commands with Discord Gateway.`));
    } catch (error) {
      console.error(chalk.red('❌ Error registering Slash Commands:'), error);
    }
  }
};
