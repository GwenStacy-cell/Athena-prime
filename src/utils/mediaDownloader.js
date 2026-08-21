import fetch from 'node-fetch';
import { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = util.promisify(exec);

async function downloadYtDlp() {
  const ytdlpPath = path.join(process.cwd(), 'yt-dlp');
  if (!fs.existsSync(ytdlpPath)) {
    console.log('[Media] Downloading yt-dlp binary...');
    const res = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp');
    const buffer = await res.buffer();
    fs.writeFileSync(ytdlpPath, buffer);
    fs.chmodSync(ytdlpPath, 0o755);
  }
  return ytdlpPath;
}

export const pendingCompressions = new Map();

export async function processMediaLink(client, message, url) {
  let buffer;
  try {
    await message.channel.sendTyping();
    let directUrl = null;
    let localFile = null;

    if (url.includes('tiktok.com')) {
      const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.data && data.data.play) directUrl = data.data.play;
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const ytdlpPath = await downloadYtDlp();
      const tempPath = path.join(process.cwd(), `yt_dlp_video_${Date.now()}.mp4`);
      console.log(`[Media] Downloading YouTube video via yt-dlp: ${url}`);
      await execPromise(`"${ytdlpPath}" -S "lang:en" -f "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]/best" -o "${tempPath}" "${url}"`);
      if (fs.existsSync(tempPath)) {
        localFile = tempPath;
      }
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      const { twitter } = await import('btch-downloader');
      const res = await twitter(url);
      if (res && res.status && res.url && res.url.length > 0) {
        directUrl = res.url[0].hd || res.url[0].sd || res.url[0].url;
      }
    } else if (url.includes('instagram.com')) {
      const ytdlpPath = await downloadYtDlp();
      const tempPath = path.join(process.cwd(), `yt_dlp_video_${Date.now()}.mp4`);
      console.log(`[Media] Downloading Instagram video via yt-dlp: ${url}`);
      await execPromise(`"${ytdlpPath}" -f "best[ext=mp4]/best" -o "${tempPath}" "${url}"`);
      if (fs.existsSync(tempPath)) {
        localFile = tempPath;
      }
    } else {
      // General Fallback
      const { igdl } = await import('btch-downloader');
      const res = await igdl(url);
      if (res && res.status && res.result && res.result.length > 0) {
        directUrl = res.result[0].url;
      }
    }

    // Universal Fallback if third-party APIs fail
    if (!localFile && !directUrl) {
      console.log(`[Media] Scraper APIs failed, using yt-dlp universally for: ${url}`);
      try {
        const ytdlpPath = await downloadYtDlp();
        const tempPath = path.join(process.cwd(), `yt_dlp_fallback_video_${Date.now()}.mp4`);
        await execPromise(`"${ytdlpPath}" -f "best[ext=mp4]/best" -o "${tempPath}" "${url}"`);
        if (fs.existsSync(tempPath)) {
          localFile = tempPath;
        }
      } catch (e) {
        console.error("yt-dlp fallback failed:", e);
      }
    }

    if (localFile) {
      buffer = fs.readFileSync(localFile);
      fs.unlinkSync(localFile); // Cleanup
    } else if (directUrl) {
      const videoRes = await fetch(directUrl);
      buffer = await videoRes.buffer();
    } else {
      return false; // Failed to extract
    }

    const attachment = new AttachmentBuilder(buffer, { name: 'Athena_Video.mp4' });

    try {
      await message.channel.send({
        content: `-# **Media Extracted** | Requested by ${message.author}`,
        files: [attachment]
      });
      await message.delete().catch(() => {});
      return true;
    } catch (sendError) {
      if (sendError && sendError.code === 40005) {
        // Discord rejected the file — upload to catbox.moe instead (up to 200MB, no account needed)
        const mb = (buffer.length / 1024 / 1024).toFixed(1);
        console.log(`[Media] Discord rejected ${mb}MB file — uploading to catbox.moe...`);
        try {
          const form = new FormData();
          form.append('reqtype', 'fileupload');
          form.append('fileToUpload', new Blob([buffer], { type: 'video/mp4' }), 'video.mp4');
          const catboxRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
          const catboxUrl = (await catboxRes.text()).trim();
          if (catboxUrl && catboxUrl.startsWith('https://')) {
            await message.channel.send({
              content: `-# **Media Extracted** | Requested by ${message.author}\n${catboxUrl}`
            });
            await message.delete().catch(() => {});
            return true;
          }
        } catch (catboxError) {
          console.error('[Media] Catbox upload failed:', catboxError);
        }
        await message.channel.send({ content: `-# **Upload Failed:** The video is **${mb}MB** and exceeded Discord's file limit. External upload also failed.` }).catch(() => null);
        return true;
      }
      throw sendError;
    }
  } catch (error) {
    console.error("Media Downloader Error:", error);
    return false;
  }
}

export async function processMp3Link(client, message, url) {
  try {
    await message.channel.sendTyping();
    const ytdlpPath = await downloadYtDlp();
    const uniqueId = Date.now().toString();
    const tempPattern = path.join(process.cwd(), `yt_dlp_audio_${uniqueId}.%(ext)s`);
    
    await execPromise(`"${ytdlpPath}" --extractor-args "youtube:lang=en" -S "lang:en" -x --audio-format mp3 -f "bestaudio[filesize<24M]/best" -o "${tempPattern}" "${url}"`);
    
    const downloadedFile = fs.readdirSync(process.cwd()).find(f => f.startsWith(`yt_dlp_audio_${uniqueId}.`));
    
    if (downloadedFile) {
      const fullPath = path.join(process.cwd(), downloadedFile);
      const buffer = fs.readFileSync(fullPath);
      fs.unlinkSync(fullPath);
      
      if (buffer.length > 25 * 1024 * 1024) {
        await message.reply({ content: '-# **The audio is too large (Limit: 25MB).**' }).catch(() => {});
        return true;
      }
      
      const attachment = new AttachmentBuilder(buffer, { name: `Athena_Audio${path.extname(downloadedFile)}` });
      await message.reply({
        content: `-# **Audio Extracted** | Requested by ${message.author}`,
        files: [attachment]
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error("Audio Downloader Error:", error);
    if (error && error.code === 40005) {
      await message.reply({ content: '-# **The media file is too large for this server\'s Discord upload limit.**' }).catch(() => {});
      return true;
    }
    await message.reply({ content: '-# **Failed to extract audio from that link.**' }).catch(() => {});
    return false;
  }
}

export async function compressVideo(url) {
  const ytdlpPath = await downloadYtDlp();
  const tempPath = path.join(process.cwd(), `yt_dlp_compressed_${Date.now()}.mp4`);
  await execPromise(`"${ytdlpPath}" -f "best[ext=mp4][filesize<9M]/bestvideo[ext=mp4][filesize<7M]+bestaudio[ext=m4a]/worst" -o "${tempPath}" "${url}"`);
  if (fs.existsSync(tempPath)) {
    const buffer = fs.readFileSync(tempPath);
    fs.unlinkSync(tempPath);
    return buffer;
  }
  return null;
}
