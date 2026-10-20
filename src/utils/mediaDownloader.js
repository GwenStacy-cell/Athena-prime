import fetch from 'node-fetch';
import { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import { fetchPinterestMedia, downloadPinterestBuffer } from './pinterest.js';

const execPromise = util.promisify(exec);

export const mediaUrlCache = new Map();

/**
 * Cache extracted media URL for 15 minutes
 * @param {string} messageId 
 * @param {string} url 
 */
export function cacheMediaUrl(messageId, url) {
  if (!messageId || !url) return;
  mediaUrlCache.set(messageId, url);
  setTimeout(() => mediaUrlCache.delete(messageId), 15 * 60 * 1000);
}

/**
 * Ensures yt-dlp binary is available locally
 * Works seamlessly on Windows (yt-dlp.exe) and Linux (yt-dlp)
 */
async function downloadYtDlp() {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const ytdlpPath = path.join(process.cwd(), binName);

  if (!fs.existsSync(ytdlpPath)) {
    console.log(`[Media] Downloading ${binName} binary...`);
    const downloadUrl = isWin
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    
    const res = await fetch(downloadUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(ytdlpPath, buffer);
    if (!isWin) {
      fs.chmodSync(ytdlpPath, 0o755);
    }
    console.log(`[Media] Downloaded ${binName} successfully.`);
  }
  return ytdlpPath;
}

export const pendingCompressions = new Map();

/**
 * Process a media link to extract and send video (MP4)
 */
export async function processMediaLink(client, message, url) {
  let buffer;
  let tempFilesToClean = [];

  try {
    await message.channel.sendTyping().catch(() => {});
    let directUrl = null;
    let localFile = null;

    // 1. TIKTOK (TikWM API - ultra fast direct MP4)
    if (url.includes('tiktok.com')) {
      try {
        const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.data && data.data.play) {
          directUrl = data.data.play;
        }
      } catch (err) {
        console.error('[Media] TikWM API failed:', err.message);
      }
    } 
    // 2. TWITTER / X (vxTwitter & FxTwitter APIs)
    else if (url.includes('twitter.com') || url.includes('x.com')) {
      const match = url.match(/(?:twitter\.com|x\.com)\/(?:[^\/]+)\/status\/(\d+)/i);
      if (match) {
        const statusId = match[1];
        try {
          const vxRes = await fetch(`https://api.vxtwitter.com/i/status/${statusId}`);
          if (vxRes.ok) {
            const vxData = await vxRes.json();
            if (vxData.media_extended && vxData.media_extended.length > 0) {
              const vid = vxData.media_extended.find(m => m.type === 'video' || m.type === 'gif');
              if (vid && vid.url) directUrl = vid.url;
            } else if (vxData.mediaURLs && vxData.mediaURLs.length > 0) {
              directUrl = vxData.mediaURLs[0];
            }
          }
        } catch (e) {
          console.error('[Media] vxTwitter API failed:', e.message);
        }

        if (!directUrl) {
          try {
            const fxRes = await fetch(`https://api.fxtwitter.com/i/status/${statusId}`);
            if (fxRes.ok) {
              const fxData = await fxRes.json();
              if (fxData.tweet?.media?.videos && fxData.tweet.media.videos.length > 0) {
                directUrl = fxData.tweet.media.videos[0].url;
              }
            }
          } catch (e) {
            console.error('[Media] FxTwitter API failed:', e.message);
          }
        }
      }
    } 
    // 3. YOUTUBE (yt-dlp with android player client + ffmpeg-static)
    else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const ytdlpPath = await downloadYtDlp();
      const tempPath = path.join(process.cwd(), `yt_dlp_video_${Date.now()}.mp4`);
      tempFilesToClean.push(tempPath);
      console.log(`[Media] Downloading YouTube video via yt-dlp: ${url}`);
      await execPromise(`"${ytdlpPath}" --ffmpeg-location "${ffmpegPath}" --extractor-args "youtube:player_client=android,web" -f "best[ext=mp4][height<=720]/bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best" --no-playlist -o "${tempPath}" "${url}"`);
      if (fs.existsSync(tempPath)) {
        localFile = tempPath;
      }
    }
    // 3.5 PINTEREST (Original High-Res Images & MP4 Videos)
    else if (url.includes('pinterest.com') || url.includes('pin.it') || url.includes('pinimg.com')) {
      try {
        const pinResult = await fetchPinterestMedia(url);
        if (pinResult.success) {
          const dl = await downloadPinterestBuffer(pinResult.mediaUrl, pinResult.fallbackUrl);
          if (dl && dl.buffer) {
            const ext = dl.extension;
            const attachment = new AttachmentBuilder(dl.buffer, { name: `Athena_Pinterest_${Date.now()}.${ext}` });
            await message.channel.send({
              content: `-# **Pinterest Media Extracted | <a:atheNATICK:1557841381630681106>** Requested by ${message.author} \u00b7 [Source Pin](${pinResult.sourceUrl})`,
              files: [attachment]
            });
            await message.delete().catch(() => {});
            return true;
          }
        }
      } catch (e) {
        console.error('[Media] Pinterest extraction failed:', e.message);
      }
    }

    // 4. Fallback for other platforms or if specialized APIs returned no direct URL
    if (!localFile && !directUrl) {
      console.log(`[Media] Executing yt-dlp fallback for: ${url}`);
      try {
        const ytdlpPath = await downloadYtDlp();
        const tempPath = path.join(process.cwd(), `yt_dlp_fallback_video_${Date.now()}.mp4`);
        tempFilesToClean.push(tempPath);
        await execPromise(`"${ytdlpPath}" --ffmpeg-location "${ffmpegPath}" -f "best[ext=mp4]/best" --no-playlist -o "${tempPath}" "${url}"`);
        if (fs.existsSync(tempPath)) {
          localFile = tempPath;
        }
      } catch (e) {
        console.error('[Media] yt-dlp fallback failed:', e.message);
      }
    }

    if (localFile) {
      buffer = fs.readFileSync(localFile);
    } else if (directUrl) {
      const videoRes = await fetch(directUrl);
      buffer = Buffer.from(await videoRes.arrayBuffer());
    } else {
      return false; // Failed to extract
    }

    const attachment = new AttachmentBuilder(buffer, { name: 'Athena_Media.mp4' });

    try {
      await message.channel.send({
        content: `-# **Media Extracted | <a:atheNATICK:1557841381630681106>** Requested by ${message.author}`,
        files: [attachment]
      });
      await message.delete().catch(() => {});
      return true;
    } catch (sendError) {
      if (sendError && sendError.code === 40005) {
        // Exceeded Discord limit -> upload to catbox.moe
        const mb = (buffer.length / 1024 / 1024).toFixed(1);
        console.log(`[Media] Discord rejected ${mb}MB file — uploading to catbox.moe...`);
        try {
          const form = new globalThis.FormData();
          form.append('reqtype', 'fileupload');
          form.append('fileToUpload', new Blob([buffer], { type: 'video/mp4' }), 'Athena_Media.mp4');
          const catboxRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
          const catboxUrl = (await catboxRes.text()).trim();
          if (catboxUrl && catboxUrl.startsWith('https://')) {
            await message.channel.send({
              content: `-# **Media Extracted | <a:atheNATICK:1557841381630681106>** Requested by ${message.author}\n${catboxUrl}`
            });
            await message.delete().catch(() => {});
            return true;
          }
        } catch (catboxError) {
          console.error('[Media] Catbox upload failed:', catboxError);
        }
        await message.channel.send({ content: `-# **Upload Failed:** The video is **${mb}MB** and exceeded Discord's file limit. External mirror also failed.` }).catch(() => null);
        return true;
      }
      throw sendError;
    }
  } catch (error) {
    console.error('[Media Downloader Error]:', error);
    return false;
  } finally {
    for (const f of tempFilesToClean) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (err) {}
    }
  }
}

/**
 * Process a media link to extract and send audio (MP3)
 */
export async function processMp3Link(client, message, url) {
  let tempFilesToClean = [];

  try {
    await message.channel.sendTyping().catch(() => {});

    // 1. TIKTOK (TikWM direct music stream - zero CPU encoding!)
    if (url.includes('tiktok.com')) {
      try {
        const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.data && data.data.music) {
          const audioRes = await fetch(data.data.music);
          const buffer = Buffer.from(await audioRes.arrayBuffer());
          if (buffer.length > 25 * 1024 * 1024) {
            await message.reply({ content: '-# **The audio is too large (Limit: 25MB).**' }).catch(() => {});
            return true;
          }
          const attachment = new AttachmentBuilder(buffer, { name: 'Athena_Audio.mp3' });
          await message.reply({
            content: `-# **Audio Extracted | <a:atheNATICK:1557841381630681106>** Requested by ${message.author}`,
            files: [attachment]
          });
          return true;
        }
      } catch (err) {
        console.error('[Media] TikWM MP3 extraction failed:', err.message);
      }
    }

    // 2. UNIVERSAL YT-DLP MP3 EXTRACTION (with ffmpeg-static)
    const ytdlpPath = await downloadYtDlp();
    const uniqueId = Date.now().toString();
    const tempPattern = path.join(process.cwd(), `yt_dlp_audio_${uniqueId}.%(ext)s`);

    await execPromise(`"${ytdlpPath}" --ffmpeg-location "${ffmpegPath}" --extractor-args "youtube:player_client=android,web" -S "lang:en" -x --audio-format mp3 -f "bestaudio[filesize<24M]/best" --no-playlist -o "${tempPattern}" "${url}"`);

    const downloadedFile = fs.readdirSync(process.cwd()).find(f => f.startsWith(`yt_dlp_audio_${uniqueId}.`));

    if (downloadedFile) {
      const fullPath = path.join(process.cwd(), downloadedFile);
      tempFilesToClean.push(fullPath);
      const buffer = fs.readFileSync(fullPath);

      if (buffer.length > 25 * 1024 * 1024) {
        await message.reply({ content: '-# **The audio is too large (Limit: 25MB).**' }).catch(() => {});
        return true;
      }

      const attachment = new AttachmentBuilder(buffer, { name: `Athena_Audio${path.extname(downloadedFile)}` });
      await message.reply({
        content: `-# **Audio Extracted | <a:atheNATICK:1557841381630681106>** Requested by ${message.author}`,
        files: [attachment]
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Audio Downloader Error]:', error);
    if (error && error.code === 40005) {
      await message.reply({ content: '-# **The media file is too large for this server\'s Discord upload limit.**' }).catch(() => {});
      return true;
    }
    await message.reply({ content: '-# **Failed to extract audio from that link.**' }).catch(() => {});
    return false;
  } finally {
    for (const f of tempFilesToClean) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (err) {}
    }
  }
}

/**
 * Video compression utility
 */
export async function compressVideo(url) {
  const ytdlpPath = await downloadYtDlp();
  const tempPath = path.join(process.cwd(), `yt_dlp_compressed_${Date.now()}.mp4`);
  await execPromise(`"${ytdlpPath}" --ffmpeg-location "${ffmpegPath}" -f "best[ext=mp4][filesize<9M]/bestvideo[ext=mp4][filesize<7M]+bestaudio[ext=m4a]/worst" --no-playlist -o "${tempPath}" "${url}"`);
  if (fs.existsSync(tempPath)) {
    const buffer = fs.readFileSync(tempPath);
    fs.unlinkSync(tempPath);
    return buffer;
  }
  return null;
}
