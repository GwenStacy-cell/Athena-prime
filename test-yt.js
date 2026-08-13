import * as cheerio from 'cheerio';

async function test() {
  const url = 'https://www.youtube.com/@ash_ae25';
  console.log('Fetching', url);
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  const channelId = $('meta[itemprop="channelId"]').attr('content');
  console.log('Found ID:', channelId);
  
  if (!channelId) {
     const ogUrl = $('meta[property="og:url"]').attr('content');
     console.log('OG URL:', ogUrl);
  }
}

test();
