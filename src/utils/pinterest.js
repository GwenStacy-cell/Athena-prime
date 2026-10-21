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

    let title = null;
    let mediaUrl = null;
    let fallbackUrl = null;
    let mediaType = 'image';

    // 1. Primary Strategy: Parse application/ld+json (canonical Pin data from Pinterest)
    const ldMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const ldTag of ldMatches) {
      const jsonStr = ldTag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      try {
        const data = JSON.parse(jsonStr);
        if (data) {
          if (!title && (data.headline || data.name || data.articleBody)) {
            title = data.headline || data.name;
          }

          // VideoObject in LD+JSON
          if (data.video && (data.video.contentUrl || typeof data.video === 'string')) {
            mediaType = 'video';
            mediaUrl = data.video.contentUrl || data.video;
            break;
          }

          // Image in LD+JSON
          let img = data.image;
          if (Array.isArray(img)) img = img[0];
          if (typeof img === 'object' && img?.url) img = img.url;
          if (typeof img === 'string' && img.includes('i.pinimg.com') && /\.(?:jpg|jpeg|png|webp|gif)/i.test(img)) {
            const orig = img.replace(/\/(?:236x|474x|564x|736x)\//i, '/originals/');
            mediaUrl = orig;
            fallbackUrl = img;
            mediaType = 'image';
            break;
          }
        }
      } catch {}
    }

    // 2. Secondary Strategy: OpenGraph & Twitter Meta Tags (pin-specific header tags)
    if (!mediaUrl) {
      const ogVideo = html.match(/<meta[^>]+(?:property|name)=["'](?:og:video|og:video:secure_url|twitter:player:stream)["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:video|og:video:secure_url|twitter:player:stream)["']/i);
      if (ogVideo && ogVideo[1] && (ogVideo[1].includes('v.pinimg.com') || ogVideo[1].includes('v1.pinimg.com') || ogVideo[1].includes('.mp4'))) {
        mediaType = 'video';
        mediaUrl = ogVideo[1];
      }
    }

    if (!mediaUrl) {
      const ogImg = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["']/i);
      if (ogImg && ogImg[1] && ogImg[1].includes('i.pinimg.com') && /\.(?:jpg|jpeg|png|webp|gif)/i.test(ogImg[1])) {
        const imgUrl = ogImg[1];
        const orig = imgUrl.replace(/\/(?:236x|474x|564x|736x)\//i, '/originals/');
        mediaUrl = orig;
        fallbackUrl = imgUrl;
        mediaType = 'image';
      }
    }

    // 3. Tertiary Strategy: Link preload or image_src tags
    if (!mediaUrl) {
      const linkImg = html.match(/<link[^>]+(?:rel=["']image_src["']|as=["']image["'])[^>]+href=["']([^"']+)["']/i) ||
                      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+(?:rel=["']image_src["']|as=["']image["'])/i);
      if (linkImg && linkImg[1] && linkImg[1].includes('i.pinimg.com') && /\.(?:jpg|jpeg|png|webp|gif)/i.test(linkImg[1])) {
        const imgUrl = linkImg[1];
        const orig = imgUrl.replace(/\/(?:236x|474x|564x|736x)\//i, '/originals/');
        mediaUrl = orig;
        fallbackUrl = imgUrl;
        mediaType = 'image';
      }
    }

    // 4. Quaternary Strategy: Scan for Video URLs in page scripts / payload
    if (!mediaUrl) {
      const videoMatches = html.match(/https?:\/\/(?:v|v1)\.pinimg\.com\/videos\/[a-zA-Z0-9_\/.-]+\.mp4/gi) ||
                           html.match(/https?:\/\/(?:v|v1)\.pinimg\.com\/[a-zA-Z0-9_\/.-]+\.mp4/gi);
      if (videoMatches && videoMatches.length > 0) {
        mediaType = 'video';
        mediaUrl = Array.from(new Set(videoMatches))[0];
      }
    }

    // 5. Quinary Fallback: Scan HTML for i.pinimg.com images (excluding UI / CSS / icons)
    if (!mediaUrl) {
      const htmlWithoutStyles = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
      const allImages = htmlWithoutStyles.match(/https?:\/\/i\.pinimg\.com\/(?:originals|736x|564x|474x|236x)\/[a-zA-Z0-9_\/.-]+(?:\.jpg|\.png|\.webp|\.gif)/gi) || [];
      const cleanImages = allImages.filter(url => {
        const lower = url.toLowerCase();
        return !lower.includes('logo') &&
               !lower.includes('avatar') &&
               !lower.includes('icon') &&
               !lower.includes('favicon') &&
               !lower.includes('transparent') &&
               !lower.includes('button') &&
               !lower.includes('d53b014d86a6b6761bf649a0ed813c2b');
      });

      if (cleanImages.length > 0) {
        const candidate = cleanImages[0];
        mediaUrl = candidate.replace(/\/(?:236x|474x|564x|736x)\//i, '/originals/');
        fallbackUrl = candidate;
        mediaType = 'image';
      }
    }

    if (!mediaUrl) {
      return { success: false, error: 'Could not locate any media file on this Pinterest page.' };
    }

    // Extract title if not set
    if (!title) {
      const ogTitle = html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:title["']/i);
      if (ogTitle && ogTitle[1] && !ogTitle[1].toLowerCase().includes('pinterest')) {
        title = ogTitle[1].trim();
      }
    }

    if (!title) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && !titleMatch[1].toLowerCase().includes('pinterest') && titleMatch[1].trim().length > 2) {
        title = titleMatch[1].trim();
      }
    }

    return {
      success: true,
      mediaType,
      mediaUrl,
      fallbackUrl: fallbackUrl || mediaUrl,
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
