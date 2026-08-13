import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { db } from '../database.js';
import embed from '../embed.js';

const parser = new Parser();

/**
 * Attempts to resolve a YouTube URL (like /c/, /user/, or /@handle) to a channel ID.
 */
export async function resolveYouTubeChannelId(url) {
  try {
    // Basic validation
    if (!url.includes('youtube.com/')) return null;

    // If it's already a channel ID format url: youtube.com/channel/UC...
    const channelMatch = url.match(/\/channel\/(UC[\w-]{22})/);
    if (channelMatch) {
      return channelMatch[1];
    }

    // Otherwise, fetch the page and extract from meta tags
    const response = await fetch(url);
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);

    // YouTube puts the channel ID in this meta tag
    const channelId = $('meta[itemprop="channelId"]').attr('content');
    return channelId || null;
  } catch (error) {
    console.error('Failed to resolve YouTube channel ID:', error);
    return null;
  }
}

/**
 * Fetches the latest video from a YouTube channel's RSS feed.
 */
export async function getLatestVideo(channelId) {
  try {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const feed = await parser.parseURL(feedUrl);
    
    if (feed.items && feed.items.length > 0) {
      const latest = feed.items[0];
      return {
        id: latest.id.replace('yt:video:', ''),
        title: latest.title,
        link: latest.link,
        author: latest.author,
        pubDate: latest.pubDate,
        thumbnail: `https://i.ytimg.com/vi/${latest.id.replace('yt:video:', '')}/maxresdefault.jpg`,
        channelName: feed.title
      };
    }
    return null;
  } catch (error) {
    // Ignore fetch errors to prevent spamming console if YouTube rate limits slightly
    return null;
  }
}

/**
 * Starts the 1-minute background loop to check for new videos.
 */
export function startYouTubeNotifier(client) {
  console.log('[YouTube Notifier] Starting 1-minute polling loop...');
  
  // Run every 1 minute (60000 ms)
  setInterval(async () => {
    try {
      const guilds = Object.keys(db.cache.guilds);
      
      for (const guildId of guilds) {
        const notifiers = db.getYouTubeNotifiers(guildId);
        if (!notifiers || notifiers.length === 0) continue;
        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;

        for (const notifier of notifiers) {
          try {
            const latestVideo = await getLatestVideo(notifier.youtubeId);
            
            if (latestVideo && latestVideo.id !== notifier.lastVideoId) {
              // We found a new video!
              const channel = guild.channels.cache.get(notifier.discordChannelId);
              
              if (channel) {
                // Determine Accent Color
                const cfg = db.getGuildConfig(guild.id);
                const accentHex = cfg?.accentColor || '#ff0000'; // Default to red for YouTube
                const accentInt = parseInt(accentHex.replace('#', ''), 16);

                // Construct Premium Embed
                const { EmbedBuilder } = await import('discord.js');
                
                const ytEmbed = new EmbedBuilder()
                  .setColor(accentInt)
                  .setAuthor({ 
                    name: `New Upload from ${latestVideo.author}`, 
                    iconURL: 'https://cdn.discordapp.com/emojis/1533383764250460241.webp?size=96&quality=lossless', 
                    url: latestVideo.link 
                  })
                  .setTitle(latestVideo.title)
                  .setURL(latestVideo.link)
                  .setImage(latestVideo.thumbnail)
                  .setFooter({ text: 'Athena Prime YouTube Notifier' })
                  .setTimestamp(new Date(latestVideo.pubDate));

                let content = notifier.customMessage || '';
                content = content.replace(/{url}/g, latestVideo.link);
                content = content.replace(/{title}/g, latestVideo.title);
                content = content.replace(/{channel}/g, latestVideo.channelName);
                
                if (content === '') {
                   content = `<:912969youtubelogo:1533383764250460241> **${latestVideo.author}** just uploaded a new video!\n${latestVideo.link}`;
                } else {
                   // Ensure link is there if they didn't put it in the custom message
                   if (!content.includes('http')) {
                      content += `\n${latestVideo.link}`;
                   }
                }

                await channel.send({ content: content, embeds: [ytEmbed] });
              }

              // Update the DB with the new video ID to prevent duplicate pings
              db.updateYouTubeNotifier(guildId, notifier.youtubeId, latestVideo.id);
            }
          } catch (innerErr) {
            console.error(`[YouTube Notifier] Failed to process ${notifier.youtubeId} in guild ${guildId}:`, innerErr);
          }
        }
      }
    } catch (err) {
      console.error('[YouTube Notifier] Interval loop error:', err);
    }
  }, 60 * 1000); // 1 minute
}
