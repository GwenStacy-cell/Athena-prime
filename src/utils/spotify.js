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

export async function fetchSpotifyData(url) {
  const t = await getSpotifyToken();
  if (!t) return null; // Fallback to old scraper if no token

  try {
    if (url.includes('/track/')) {
      const id = url.split('/track/')[1].split('?')[0];
      const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        type: 'track',
        queries: [`ytmsearch:${data.name} ${data.artists[0].name}`]
      };
    } 
    else if (url.includes('/album/')) {
      const id = url.split('/album/')[1].split('?')[0];
      const res = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      
      const queries = data.tracks.items.map(track => `ytmsearch:${track.name} ${track.artists[0].name}`);
      return { type: 'playlist', title: data.name, queries };
    }
    else if (url.includes('/playlist/')) {
      const id = url.split('/playlist/')[1].split('?')[0];
      const res = await fetch(`https://api.spotify.com/v1/playlists/${id}`, {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      
      const queries = [];
      for (const item of data.tracks.items) {
        if (item.track && item.track.name) {
           queries.push(`ytmsearch:${item.track.name} ${item.track.artists[0].name}`);
        }
      }
      return { type: 'playlist', title: data.name, queries };
    }
  } catch (error) {
    console.error('Spotify API Error:', error);
  }
  
  return null;
}
