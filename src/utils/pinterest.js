/**
 * Pinterest Media Extraction Engine for Athena Prime
 * Extracts original high-resolution images (i.pinimg.com/originals) and MP4 videos
 * from Pinterest pins and short links (pin.it).
 */

const PINTEREST_URL_REGEX = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?pinterest\.[a-z.]+(?:\/pin\/[0-9]+[^\s]*|\/[a-zA-Z0-9_\/-]+)?|https?:\/\/pin\.it\/[a-zA-Z0-9]+[^\s]*|https?:\/\/i\.pinimg\.com\/[^\s]+/i;

const GLOBAL_PINTEREST_REGEX = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?pinterest\.[a-z.]+(?:\/pin\/[0-9]+[^\s]*|\/[a-zA-Z0-9_\/-]+)?|https?:\/\/pin\.it\/[a-zA-Z0-9]+[^\s]*|https?:\/\/i\.pinimg\.com\/[^\s]+/gi;

/**
 * Checks if a string contains any Pinterest URL
 */
export function isPinterestUrl(text = '') {
  if (!text || typeof text !== 'string') return false;
  return PINTEREST_URL_REGEX.test(text);
}

/**
 * Extracts all Pinterest URLs from a string
 */
export function extractPinterestUrls(text = '') {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(GLOBAL_PINTEREST_REGEX);
  if (!matches) return [];
  return matches.map(u => u.replace(/[>\]\)\.,;]+$/, '').trim());
}

/**
 * Formats bytes into a human-readable string (KB, MB)
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Fetches and extracts high-resolution media information from a Pinterest pin URL
 */
export async function fetchPinterestMedia(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { success: false, error: 'No URL provided.' };
  }

  let cleanUrl = inputUrl.trim().replace(/[>\]\)\.,;]+$/, '');
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  // Direct pinimg CDN URL
  if (/^https?:\/\/i\.pinimg\.com\//i.test(cleanUrl)) {
    const orig = cleanUrl.replace(/\/(?:236x|474x|564x|736x)\//i, '/originals/');
    return {
      success: true,
      mediaType: 'image',
      mediaUrl: orig,
      fallbackUrl: cleanUrl,
      sourceUrl: cleanUrl,
      title: 'Pinterest Image'
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { success: false, error: `Pinterest returned HTTP status ${res.status}.` };
    }

    const finalUrl = res.url;
    const html = await res.text();

    // 1. Detect Pinterest MP4 Videos
    const videoMatches = html.match(/https?:\/\/(?:v|v1)\.pinimg\.com\/videos\/[a-zA-Z0-9_\/.-]+\.mp4/gi) ||
                         html.match(/https?:\/\/(?:v|v1)\.pinimg\.com\/[a-zA-Z0-9_\/.-]+\.mp4/gi);
    if (videoMatches && videoMatches.length > 0) {
      const bestVideo = Array.from(new Set(videoMatches))[0];
      return {
        success: true,
        mediaType: 'video',
        mediaUrl: bestVideo,
        sourceUrl: finalUrl,
        title: 'Pinterest Video'
      };
    }

    // 2. Detect Images
    const rawImages = [];

    // Check for originals
    const origMatches = html.match(/https?:\/\/i\.pinimg\.com\/originals\/[a-zA-Z0-9_\/.-]+(?:\.jpg|\.png|\.webp|\.gif)/gi) || [];
    for (const m of origMatches) rawImages.push(m);

    // Check for 736x, 564x, 474x, 236x and upgrade to originals
    const resizedMatches = html.match(/https?:\/\/i\.pinimg\.com\/(?:736x|564x|474x|236x)\/[a-zA-Z0-9_\/.-]+(?:\.jpg|\.png|\.webp|\.gif)/gi) || [];
    for (const m of resizedMatches) {
      rawImages.push(m.replace(/\/(?:736x|564x|474x|236x)\//i, '/originals/'));
      rawImages.push(m);
    }

    // OpenGraph meta tag fallback
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                  html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
    if (ogImg) {
      rawImages.unshift(ogImg[1].replace(/\/(?:736x|564x|474x|236x)\//i, '/originals/'));
      rawImages.push(ogImg[1]);
    }

    const candidates = Array.from(new Set(rawImages));
    if (candidates.length === 0) {
      return { success: false, error: 'Could not locate any image or video media on this Pinterest page.' };
    }

    const selectedUrl = candidates[0];
    const fallback = candidates.find(u => u.includes('/736x/')) || candidates[0];

    // Extract title
    let title = null;
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && !titleMatch[1].toLowerCase().includes('pinterest') && titleMatch[1].trim().length > 2) {
      title = titleMatch[1].trim();
    }

    return {
      success: true,
      mediaType: 'image',
      mediaUrl: selectedUrl,
      fallbackUrl: fallback,
      sourceUrl: finalUrl,
      title: title || 'Pinterest Media'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Downloads media into a binary Buffer with fallback handling
 */
export async function downloadPinterestBuffer(mediaUrl, fallbackUrl) {
  let target = mediaUrl;
  let res = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    res = await fetch(target, { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch {
    res = null;
  }

  // If originals 404'd or failed, fall back to resized (736x)
  if (!res || !res.ok) {
    if (fallbackUrl && fallbackUrl !== mediaUrl) {
      target = fallbackUrl;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        res = await fetch(target, { signal: controller.signal });
        clearTimeout(timeoutId);
      } catch {
        res = null;
      }
    }
  }

  if (!res || !res.ok) {
    return null;
  }

  const contentType = res.headers.get('content-type') || '';
  const buffer = Buffer.from(await res.arrayBuffer());

  let extension = 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
  else if (contentType.includes('webp')) extension = 'webp';
  else if (contentType.includes('gif')) extension = 'gif';
  else if (contentType.includes('mp4') || target.endsWith('.mp4')) extension = 'mp4';
  else if (target.endsWith('.png')) extension = 'png';
  else if (target.endsWith('.jpg') || target.endsWith('.jpeg')) extension = 'jpg';

  return {
    buffer,
    extension,
    contentType,
    sizeBytes: buffer.byteLength,
    url: target
  };
}
