import { CronJob } from 'cron';
import { EmbedBuilder } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 5000,
  headers: {
    'User-Agent': 'AthenaPrime/1.0.0 (Discord Bot)'
  }
});

let isRunning = false;

async function checkNews(client) {
  if (isRunning) return;
  isRunning = true;

  try {
    for (const [guildId, config] of Object.entries(db.cache.newsFeeds)) {
      if (!config.channelId || !config.feeds || config.feeds.length === 0) continue;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      const channel = guild.channels.cache.get(config.channelId);
      if (!channel) continue;

      let newGuids = [];
      const previousGuids = new Set(config.lastGuids || []);

      for (const feedConfig of config.feeds) {
        try {
          const feed = await parser.parseURL(feedConfig.url);
          
          // Sort items by date, oldest to newest (to post chronologically)
          const items = feed.items.sort((a, b) => {
            return new Date(a.isoDate || a.pubDate).getTime() - new Date(b.isoDate || b.pubDate).getTime();
          });

          for (const item of items) {
            const guid = item.guid || item.id || item.link;
            
            if (!previousGuids.has(guid)) {
              // It's a new article!
              newGuids.push(guid);
              previousGuids.add(guid);

              const newsEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setAuthor({ name: feedConfig.name, iconURL: feed.image?.url || 'https://i.imgur.com/vHq49n8.png' })
                .setTitle(item.title ? item.title.substring(0, 250) : 'New Article')
                .setURL(item.link || feedConfig.url)
                .setDescription(item.contentSnippet || item.content || 'Click the link to read more.')
                .setFooter({ text: `Source: ${feed.title || feedConfig.name}` })
                .setTimestamp(new Date(item.isoDate || item.pubDate || Date.now()));

              // Try to extract an image from enclosure or content
              if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
                newsEmbed.setImage(item.enclosure.url);
              } else if (item.content && item.content.match(/<img[^>]+src="([^">]+)"/)) {
                const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
                if (imgMatch && imgMatch[1]) {
                  newsEmbed.setImage(imgMatch[1]);
                }
              }

              const content = config.roleId ? `<@&${config.roleId}>` : '';
              
              await channel.send({ content: content, embeds: [newsEmbed] }).catch(() => null);
            }
          }
        } catch (err) {
          console.error(`[NewsFeed] Error fetching feed ${feedConfig.url} for guild ${guildId}:`, err.message);
        }
      }

      // If we posted new articles, save the new GUIDs to the DB
      if (newGuids.length > 0) {
        db.updateNewsGuids(guildId, newGuids);
      }
    }
  } catch (err) {
    console.error('[NewsFeed] Error in cron loop:', err);
  } finally {
    isRunning = false;
  }
}

export function startNewsJob(client) {
  // Check every 15 minutes
  const job = new CronJob('*/15 * * * *', () => {
    checkNews(client);
  });
  job.start();

  // Also do an initial check immediately on boot (delayed slightly to ensure bot is fully ready)
  setTimeout(() => checkNews(client), 15000);
}
