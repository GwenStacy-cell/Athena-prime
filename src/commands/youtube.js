import { PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
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
        let channelMention = message.mentions.channels.first();
        
        // If no mention, try resolving by ID or Name
        if (!channelMention && args[2]) {
          // Check if args[2] is just a channel ID, or reconstruct the remaining string to find a name
          const potentialId = args[2].replace(/[<#>]/g, '');
          channelMention = message.guild.channels.cache.get(potentialId);
          
          if (!channelMention) {
             const nameQuery = args.slice(2).join(' ').toLowerCase();
             channelMention = message.guild.channels.cache.find(c => c.name.toLowerCase() === nameQuery || c.name.toLowerCase().includes(nameQuery));
          }
        }
        
        if (!url || !channelMention) {
          return message.reply({ embeds: [embed.error('Syntax Error', `Usage: \`${prefix}youtube add <url> <#channel> [message]\`\n\nExample:\n\`${prefix}youtube add https://youtube.com/@MrBeast #videos @everyone New Video!\``)] });
        }

        // The custom message is everything after the channel name/mention
        // We will just do a simple replace or slice
        let customMessage = '';
        const channelMentionStr = `<#${channelMention.id}>`;
        if (message.content.includes(channelMentionStr)) {
            const channelStrIndex = message.content.indexOf(channelMentionStr);
            customMessage = message.content.slice(channelStrIndex + channelMentionStr.length).trim();
        } else {
            // They typed the name, we'll just leave custom message blank unless they put it in quotes, but let's just grab the end
            // This is a bit tricky, if they typed the name, we don't know where the name ends and the message begins.
            // For safety, if they didn't mention it, we won't extract a custom message easily, but we can try removing the channel name
            const msgAfterUrl = message.content.substring(message.content.indexOf(url) + url.length).trim();
            const lowerMsg = msgAfterUrl.toLowerCase();
            const lowerName = channelMention.name.toLowerCase();
            if (lowerMsg.includes(lowerName)) {
               const idx = lowerMsg.indexOf(lowerName);
               customMessage = msgAfterUrl.slice(idx + lowerName.length).trim();
            }
        }

        const waitMsg = await message.reply({ embeds: [embed.info('Processing...', '<a:Loading:1537404628826587207> Resolving channel ID and fetching data...')] });
        
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
          recentVideoIds: lastVideoId ? [lastVideoId] : [],
          channelName: channelName
        });

        // Determine Accent Color
        const cfg = db.getGuildConfig(message.guild.id);
        const accentHex = cfg?.accentColor || '#ff0000';
        const accentInt = parseInt(accentHex.replace('#', ''), 16);
        const { EmbedBuilder } = await import('discord.js');

        // Delete the processing message
        await waitMsg.delete().catch(() => {});
        await message.reply({ embeds: [embed.success('System Linked', `YouTube tracker for **${channelName}** successfully bound to ${channelMention}.`)] });

        // Build premium success embed for target channel
        const successEmbed = new EmbedBuilder()
          .setColor(accentInt)
          .setAuthor({ 
            name: `YouTube Integration Active`, 
            iconURL: 'https://cdn.discordapp.com/emojis/1533383764250460241.webp?size=96&quality=lossless'
          })
          .setTitle(`Successfully Linked: ${channelName}`)
          .setURL(url)
          .setDescription(`> <a:z_arrow_pink1:1523082728004653138> **This channel will now automatically receive notifications whenever __${channelName}__ uploads a new video!**`)
          .setFooter({ text: 'Athena Prime YouTube Notifier' })
          .setTimestamp();
          
        if (latestVideo && latestVideo.thumbnail) {
          successEmbed.setImage(latestVideo.thumbnail);
        }

        let channelMsg = '';
        if (customMessage) {
            channelMsg = `**Ping Message:**\n${customMessage}`;
        }

        // Send to target channel
        await channelMention.send({ content: channelMsg, embeds: [successEmbed] }).catch(() => {});
      }
    }
  }
];
