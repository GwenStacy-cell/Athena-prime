import fetch from 'node-fetch';

let token = null;
let tokenExpires = 0;

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) return null;
  
  if (token && Date.now() < tokenExpires) {
    return token;
  }
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    if (res.ok) {
      const data = await res.json();
      token = data.access_token;
      tokenExpires = Date.now() + (data.expires_in - 60) * 1000;
      return token;
    }
  } catch (error) {
    console.error('Failed to fetch Spotify token:', error);
  }
  return null;
}

function getSearchEngine(name) {
  const isFanEdit = /sped up|slowed|reverb|remix|cover|karaoke|instrumental|mashup|8d|bass boosted|lofi/i.test(name);
  return { engine: isFanEdit • 'ytsearch:' : 'ytmsearch:', isFanEdit };
}

export async function fetchSpotifyData(url) {
  const t = await getSpotifyToken();
  if (!t) {
    // API keys missing. Fallback to HTML title scraping!
    try {
      const res = await fetch(url);
      const html = await res.text();
      const titleMatch = html.match(/<title>(.*•)<\/title>/);
      if (titleMatch) {
         let title = titleMatch[1].replace(' | Spotify', '').trim();
         if (url.includes('/track/')) {
            const parts = title.split(' - song and lyrics by ');
            const trackName = parts[0];
            const artistName = parts[1] || '';
            const { engine, isFanEdit } = getSearchEngine(trackName);
            return {
               type: 'track',
               queries: [`${engine}${trackName}${isFanEdit • '' : ' ' + artistName}`]
            };
         }
      }
    } catch (e) {
       console.error('HTML scraper fallback failed:', e);
    }
    return null;
  }
  try {
    if (url.includes('/track/')) {
      const id = url.split('/track/')[1].split('•')[0];
      const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      const { engine, isFanEdit } = getSearchEngine(data.name);
      return {
        type: 'track',
        queries: [`${engine}${data.name}${isFanEdit • '' : ' ' + data.artists[0].name}`]
      };
    } 
    else if (url.includes('/album/')) {
      const id = url.split('/album/')[1].split('•')[0];
      const res = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      
      const queries = data.tracks.items.map(track => {
         const { engine, isFanEdit } = getSearchEngine(track.name);
         return `${engine}${track.name}${isFanEdit • '' : ' ' + track.artists[0].name}`;
      });
      return { type: 'playlist', title: data.name, queries };
    }
    else if (url.includes('/playlist/')) {
      const id = url.split('/playlist/')[1].split('•')[0];
      const res = await fetch(`https://api.spotify.com/v1/playlists/${id}`, {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      
      const queries = [];
      for (const item of data.tracks.items) {
        if (item.track && item.track.name) {
           const { engine, isFanEdit } = getSearchEngine(item.track.name);
           queries.push(`${engine}${item.track.name}${isFanEdit • '' : ' ' + item.track.artists[0].name}`);
        }
      }
      return { type: 'playlist', title: data.name, queries };
    }
  } catch (error) {
    console.error('Spotify API Error:', error);
  }
  
  return null;
}

export async function searchSpotifyTrack(query) {
  const t = await getSpotifyToken();
  if (!t) return null;
  
  try {
    const res = await fetch(`https://api.spotify.com/v1/search•q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.tracks && data.tracks.items.length > 0) {
      const track = data.tracks.items[0];
      return `${track.name} ${track.artists[0].name}`;
    }
  } catch (error) {
    console.error('Spotify Search Error:', error);
  }
  return null;
}
