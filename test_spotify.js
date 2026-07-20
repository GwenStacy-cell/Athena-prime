import fetch from 'node-fetch';

fetch('https://open.spotify.com/track/3Gr76lR4VmMOIYy9OS7vbG', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
})
.then(res => res.text())
.then(html => {
  const match = html.match(/<meta property="og:title" content="(.*?)"/);
  console.log('Title:', match ? match[1] : 'No title');
  
  const descMatch = html.match(/<meta property="og:description" content="(.*?)"/);
  console.log('Desc:', descMatch ? descMatch[1] : 'No desc');
});
