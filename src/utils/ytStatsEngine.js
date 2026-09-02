import db from '../database.js';

export async function scrapeSubscriberCount(handle) {
  try {
    const url = handle.startsWith('UC') ? `https://www.youtube.com/channel/${handle}` : `https://www.youtube.com/${handle}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' }});
    if (!res.ok) return null;
    const text = await res.text();
    
    // New YouTube PageHeaderViewModel layout
    const headerMatch = text.match(/"pageHeaderViewModel"[\s\S]*?"content":"([^"]*?(?:subscribers?|subs))"/i);
    if (headerMatch) {
      let raw = headerMatch[1];
      raw = raw.replace(/ subscribers?/i, '').trim();
      return raw;
    }
    
    // Legacy accessibility layout
    const match = text.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+?)"\}\},"simpleText":"([^"]+?)"\}/);
    if (match) {
      let raw = match[2];
      raw = raw.replace(/ subscribers?/i, '').trim();
      return raw;
    }
    
    // Ultimate Fallback regex
    const fallback = text.match(/"content":"([^"]*?(?:subscribers?|subs))"/i);
    if (fallback) {
      let raw = fallback[1];
      raw = raw.replace(/ subscribers?/i, '').trim();
      return raw;
    }

    const simpleFallback = text.match(/([0-9\\.,kKmM]+)\s+subscribers/i);
    if (simpleFallback) {
      return simpleFallback[1].trim();
    }
    
    return null;
  } catch (err) {
    console.error(`[YT Stats] Failed to scrape ${handle}:`, err.message);
    return null;
  }
}

export async function forceUpdateYtStats(guild) {
  const config = db.getGuildConfig(guild.id);
  if (!config || !config.ytStats || config.ytStats.length === 0) return;
  
  for (const stat of config.ytStats) {
    const channel = guild.channels.cache.get(stat.channelId);
    if (!channel) continue;
    
    const subs = await scrapeSubscriberCount(stat.handle);
    if (!subs) continue;
    
    const newName = stat.format.replace('{count}', subs);
    if (channel.name !== newName) {
      // Catch ratelimits silently
      await channel.setName(newName).catch(e => console.log(`[YT Stats] Failed to rename channel in ${guild.id}: ${e.message}`));
    }
  }
}

export function startYtStatsEngine(client) {
  // Update exactly every 10 minutes (600,000 ms)
  setInterval(() => {
    client.guilds.cache.forEach(guild => {
      forceUpdateYtStats(guild).catch(() => null);
    });
  }, 10 * 60 * 1000);
}
