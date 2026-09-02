import db from '../database.js';

export async function scrapeYouTubeMetrics(handle) {
  try {
    const url = handle.startsWith('UC') ? `https://www.youtube.com/channel/${handle}` : `https://www.youtube.com/${handle}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' }});
    if (!res.ok) return { subs: null, videos: null };
    const text = await res.text();
    
    let subs = null;
    let videos = null;
    
    // Extract Videos
    const vidsMatch = text.match(/"content":"([^"]*?\s+videos)"/i) || text.match(/([0-9\\.,kKmM]+)\s+videos/i);
    if (vidsMatch) {
      videos = vidsMatch[1].replace(/ videos?/i, '').trim();
    }
    
    // Extract Subs
    const headerMatch = text.match(/"pageHeaderViewModel"[\s\S]*?"content":"([^"]*?(?:subscribers?|subs))"/i);
    if (headerMatch) subs = headerMatch[1].replace(/ subscribers?/i, '').trim();
    
    if (!subs) {
      const match = text.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+?)"\}\},"simpleText":"([^"]+?)"\}/);
      if (match) subs = match[2].replace(/ subscribers?/i, '').trim();
    }
    
    if (!subs) {
      const fallback = text.match(/"content":"([^"]*?(?:subscribers?|subs))"/i);
      if (fallback) subs = fallback[1].replace(/ subscribers?/i, '').trim();
    }

    if (!subs) {
      const simpleFallback = text.match(/([0-9\\.,kKmM]+)\s+subscribers/i);
      if (simpleFallback) subs = simpleFallback[1].trim();
    }
    
    return { subs, videos };
  } catch (err) {
    console.error(`[YT Stats] Failed to scrape ${handle}:`, err.message);
    return { subs: null, videos: null };
  }
}

export async function forceUpdateYtStats(guild) {
  const config = db.getGuildConfig(guild.id);
  if (!config || !config.ytStats || config.ytStats.length === 0) return;
  
  // Group by handle to avoid fetching the same URL multiple times
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
    
    if (channel.name !== newName && !newName.includes('{count}') && !newName.includes('{subs}') && !newName.includes('{videos}')) {
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
