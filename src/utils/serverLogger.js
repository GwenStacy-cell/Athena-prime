import { ChannelType } from 'discord.js';
import db from '../database.js';

/**
 * Core logging engine for Server Logs.
 * 
 * @param {Guild} guild - The Discord guild object
 * @param {string} moduleName - e.g., 'bans', 'kicks', 'msgDeletes'
 * @param {EmbedBuilder} embedData - The EmbedBuilder payload
 */
export async function logServerEvent(guild, moduleName, embedData) {
  try {
    const config = db.getGuildConfig(guild.id);
    const serverLogs = config.serverLogs;

    // Fast fail if completely disabled
    if (!serverLogs || !serverLogs.enabled) return;

    const moduleConfig = serverLogs.modules[moduleName];
    // Fast fail if module doesn't exist or is disabled
    if (!moduleConfig || !moduleConfig.enabled) return;

    // Resolve channel (Module specific -> Default fallback)
    const targetChannelId = moduleConfig.channelId || serverLogs.defaultChannelId;
    if (!targetChannelId) return;

    // Ensure we can access the channel
    const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) return;

    // Send the log
    await channel.send({ embeds: [embedData] }).catch(() => null);
  } catch (error) {
    console.error(`[ServerLogger] Failed to log ${moduleName} event in guild ${guild.id}:`, error);
  }
}
