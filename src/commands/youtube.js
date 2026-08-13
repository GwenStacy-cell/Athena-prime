import { PermissionFlagsBits } from 'discord.js';
import { db } from '../database.js';
import embed from '../embed.js';
import { isAuthorized } from '../utils/helpers.js';
import { resolveYouTubeChannelId, getLatestVideo } from '../utils/youtubeNotifier.js';

export const commands = [
  {
    name: 'youtube',
    description: 'Manage YouTube upload notifiers for the server.',
    category: 'engagement',
    permissions: [], // Restricted via isAuthorized manually
    async executePrefix(message, args) {
      if (!await isAuthorized(message.author, message.guild)) {
        return message.reply({ embeds: [embed.error('Access Denied', 'You do not have permission to use this command.')] });
      }

      const subcommand = args[0]?.toLowerCase();
      const prefix = db.getGuildConfig(message.guild.id)?.prefix || '!';

      if (!subcommand || !['add', 'remove', 'list'].includes(subcommand)) {
        return message.reply({ 
          embeds: [embed.info('YouTube Notifier', 
            `Monitor YouTube channels and send an alert when a new video is uploaded!\n\n` +
            `**Usage:**\n` +
            `\`${prefix}youtube add <url> <#channel> [message]\`\n` +
            `\`${prefix}youtube remove <url>\`\n` +
            `\`${prefix}youtube list\``
          )] 
        });
      }

      // --- LIST COMMAND ---
      if (subcommand === 'list') {
        const notifiers = db.getYouTubeNotifiers(message.guild.id);
        if (notifiers.length === 0) {
          return message.reply({ embeds: [embed.info('YouTube Notifier', 'There are no active YouTube notifiers in this server.')] });
        }

        let desc = '';
        notifiers.forEach((n, i) => {
          desc += `**${i + 1}. [${n.channelName || 'YouTube Channel'}](${n.youtubeUrl})**\n`;
          desc += `<:emoji_51:1515256213192048690> Target Channel: <#${n.discordChannelId}>\n\n`;
        });

        return message.reply({ embeds: [embed.info('YouTube Notifiers', desc)] });
      }

      // --- REMOVE COMMAND ---
      if (subcommand === 'remove') {
        const url = args[1];
        if (!url) return message.reply({ embeds: [embed.error('Syntax Error', `Usage: \`${prefix}youtube remove <url>\``)] });

        const waitMsg = await message.reply({ embeds: [embed.info('Processing...', 'Resolving channel ID...')] });
        const channelId = await resolveYouTubeChannelId(url);

        if (!channelId) {
          return waitMsg.edit({ embeds: [embed.error('Error', 'Could not resolve a YouTube channel from that URL.')] });
        }

        const success = db.removeYouTubeNotifier(message.guild.id, channelId);
        if (success) {
          return waitMsg.edit({ embeds: [embed.success('Removed', `Successfully removed YouTube tracker for channel ID \`${channelId}\`.`)] });
        } else {
          return waitMsg.edit({ embeds: [embed.error('Not Found', 'That channel is not currently being tracked.')] });
        }
      }

      // --- ADD COMMAND ---
      if (subcommand === 'add') {
        const url = args[1];
        const channelMention = message.mentions.channels.first();
        
        if (!url || !channelMention) {
          return message.reply({ embeds: [embed.error('Syntax Error', `Usage: \`${prefix}youtube add <url> <#channel> [message]\`\n\nExample:\n\`${prefix}youtube add https://youtube.com/@MrBeast #videos @everyone New Video!\``)] });
        }

        // The custom message is everything after the channel mention
        const messageIndex = message.content.indexOf(args[2]);
        let customMessage = '';
        
        // We have to extract the custom message carefully
        // args[2] could be the channel mention like <#1234>
        // But what if it's multiple spaces? Let's just slice the raw string
        const channelMatch = message.content.match(/<#(\d+)>/);
        if (channelMatch) {
            const rawContent = message.content;
            const channelStrIndex = rawContent.indexOf(channelMatch[0]);
            customMessage = rawContent.slice(channelStrIndex + channelMatch[0].length).trim();
        }

        const waitMsg = await message.reply({ embeds: [embed.info('Processing...', '<a:z_loading:1523671239564988528> Resolving channel ID and fetching data...')] });
        
        const channelId = await resolveYouTubeChannelId(url);
        if (!channelId) {
          return waitMsg.edit({ embeds: [embed.error('Error', 'Could not resolve a YouTube channel from that URL. Please ensure it is a valid channel URL.')] });
        }

        // Check if already tracking
        const currentNotifiers = db.getYouTubeNotifiers(message.guild.id);
        if (currentNotifiers.some(n => n.youtubeId === channelId)) {
          return waitMsg.edit({ embeds: [embed.warn('Already Tracked', 'This YouTube channel is already being tracked!')] });
        }

        // Fetch latest video to get the channel name and prevent pinging old videos on startup
        const latestVideo = await getLatestVideo(channelId);
        const channelName = latestVideo ? latestVideo.channelName : 'Unknown Channel';
        const lastVideoId = latestVideo ? latestVideo.id : null;

        db.addYouTubeNotifier(message.guild.id, {
          youtubeId: channelId,
          youtubeUrl: url,
          discordChannelId: channelMention.id,
          customMessage: customMessage,
          lastVideoId: lastVideoId,
          channelName: channelName
        });

        let successDesc = `Successfully bound **${channelName}** to ${channelMention}!\n\nI will check for new uploads every 1 minute.`;
        if (customMessage) {
            successDesc += `\n\n**Custom Message:**\n\`${customMessage}\``;
        }

        return waitMsg.edit({ embeds: [embed.success('YouTube Notifier Active', successDesc)] });
      }
    }
  }
];
