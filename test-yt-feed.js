import Parser from 'rss-parser';

async function test() {
  const parser = new Parser();
  const channelId = 'UC2BG6_zVCdmPitLR_r0IYvg'; // Minato? No, ash_ae25
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}&_=${Date.now()}`;
  const feed = await parser.parseURL(feedUrl);
  
  if (feed.items && feed.items.length > 0) {
    const latest = feed.items[0];
    console.log('Latest video:', latest.title);
    console.log('Published:', latest.pubDate);
    console.log('ID:', latest.id);
  } else {
    console.log('No videos found.');
  }
}

test();
