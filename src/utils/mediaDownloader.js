import fetch from 'node-fetch';
import { AttachmentBuilder } from 'discord.js';

export async function processMediaLink(client, message, url) {
  try {
    await message.channel.sendTyping();
    let directUrl = null;

    if (url.includes('tiktok.com')) {
      const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.data && data.data.play) directUrl = data.data.play;
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const { youtube } = await import('btch-downloader');
      const res = await youtube(url);
      if (res && res.status && res.mp4) {
        directUrl = res.mp4;
      }
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      const { twitter } = await import('btch-downloader');
      const res = await twitter(url);
      if (res && res.status && res.url && res.url.length > 0) {
        directUrl = res.url[0].hd || res.url[0].sd || res.url[0].url;
      }
    } else {
      // Instagram / Fallback
      const { igdl } = await import('btch-downloader');
      const res = await igdl(url);
      if (res && res.status && res.result && res.result.length > 0) {
        directUrl = res.result[0].url;
      }
    }

    if (!directUrl) return false;

    const videoRes = await fetch(directUrl);
    const buffer = await videoRes.buffer();

    if (buffer.length > 25 * 1024 * 1024) {
      await message.reply({ content: '-# ❌ **The video is too large to upload directly to Discord (Limit: 25MB).**' }).catch(() => {});
      return true;
    }

    const attachment = new AttachmentBuilder(buffer, { name: 'Athena_Video.mp4' });

    await message.channel.send({
      content: `-# 📥 **Media Extracted** | Requested by ${message.author}`,
      files: [attachment]
    });

    await message.delete().catch(() => {});
    return true;
  } catch (error) {
    console.error("Media Downloader Error:", error);
    return false;
  }
}
