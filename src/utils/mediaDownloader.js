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
    } else {
      const res = await fetch('https://api.cobalt.tools/api/json', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: url, isNoWatermark: true })
      });
      const data = await res.json();
      if (data && data.url) directUrl = data.url;
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
    return false;
  }
}
