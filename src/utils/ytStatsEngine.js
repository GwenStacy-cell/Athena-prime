import db from '../database.js';
import { resolveYouTubeChannelId } from './youtubeNotifier.js';

export async function scrapeYouTubeMetrics(handle) {
  const result = { subs: null, videos: null, views: null };
  const url = handle.startsWith('UC') ? `https://www.youtube.com/channel/${handle}` : `https://www.youtube.com/${handle}`;
  
  const formatNum = (num) => {
    if (!num) return null;
    const n = parseInt(num, 10);
    if (isNaN(n)) return num; // Already formatted by HTML scraper
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
  };

  // 1. Primary: Exact HTML Scraping for Subs & Videos (Always 100% Accurate)
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' }});
    if (res.ok) {
      const text = await res.text();
      
      const vidsMatch = text.match(/"content":"([^"]*?\s+videos)"/i) || text.match(/([0-9\\.,kKmM]+)\s+videos/i);
      if (vidsMatch) result.videos = vidsMatch[1].replace(/ videos?/i, '').trim();
      
      const headerMatch = text.match(/"pageHeaderViewModel"[\s\S]*?"content":"([^"]*?(?:subscribers?|subs))"/i);
      if (headerMatch) result.subs = headerMatch[1].replace(/ subscribers?/i, '').trim();
      
      if (!result.subs) {
        const match = text.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+?)"\}\},"simpleText":"([^"]+?)"\}/);
        if (match) result.subs = match[2].replace(/ subscribers?/i, '').trim();
      }
      
      if (!result.subs) {
        const fallback = text.match(/"content":"([^"]*?(?:subscribers?|subs))"/i);
        if (fallback) result.subs = fallback[1].replace(/ subscribers?/i, '').trim();
      }

      if (!result.subs) {
        const simpleFallback = text.match(/([0-9\\.,kKmM]+)\s+subscribers/i);
        if (simpleFallback) result.subs = simpleFallback[1].trim();
      }
    }
  } catch (err) {
    console.error(`[YT Stats] HTML Scraper failed for ${handle}:`, err.message);
  }

  // 2. Secondary: Mixerno API for Total Views (Hidden from HTML)
  try {
    const channelId = await resolveYouTubeChannelId(url);
    if (channelId) {
      const apiRes = await fetch(`https://mixerno.space/api/youtube-channel-counter/user/${channelId}`);
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data && data.counts) {
           const v = data.counts.find(c => c.value === 'views')?.count;
           if (v) result.views = formatNum(v);
           
           // Fallbacks if HTML failed
           if (!result.subs) {
             const s = data.counts.find(c => c.value === 'subscribers')?.count;
             if (s) result.subs = formatNum(s);
           }
           if (!result.videos) {
             const vid = data.counts.find(c => c.value === 'videos')?.count;
             if (vid) result.videos = vid.toString();
           }
        }
      }
    }
  } catch (err) {
    console.error(`[YT Stats] Mixerno API failed for ${handle}:`, err.message);
  }
  
  return result;
}

export async function forceUpdateYtStats(guild) {
  const config = db.getGuildConfig(guild.id);
  if (!config || !config.ytStats || config.ytStats.length === 0) return;
  
  const uniqueHandles = [...new Set(config.ytStats.map(s => s.handle))];
  const cachedMetrics = {};
  
  for (const handle of uniqueHandles) {
    cachedMetrics[handle] = await scrapeYouTubeMetrics(handle);
  }
  
  for (const stat of config.ytStats) {
    const channel = guild.channels.cache.get(stat.channelId);
    if (!channel) continue;
    
    const metrics = cachedMetrics[stat.handle];
    if (!metrics) continue;
    
    let newName = stat.format;
    if (metrics.subs) {
      newName = newName.replace('{count}', metrics.subs).replace('{subs}', metrics.subs);
    }
    if (metrics.videos) {
      newName = newName.replace('{videos}', metrics.videos);
    }
    if (metrics.views) {
      newName = newName.replace('{views}', metrics.views);
    }
    
    if (channel.name !== newName && !newName.includes('{count}') && !newName.includes('{subs}') && !newName.includes('{videos}') && !newName.includes('{views}')) {
      await channel.setName(newName).catch(() => null);
    }
  }
}

export function startYtStatsEngine(client) {
  setInterval(() => {
    client.guilds.cache.forEach(guild => {
      forceUpdateYtStats(guild).catch(() => null);
    });
  }, 10 * 60 * 1000);
}
