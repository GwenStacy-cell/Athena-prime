import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { AttachmentBuilder } from 'discord.js';

const TEMP_DIR = path.resolve('temp_media');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

/**
 * Downloads an MP4, converts it to GIF, and returns the converted buffer.
 * Max duration is set to 10 seconds to prevent massive files.
 */
export async function convertMp4ToGif(url) {
  const fileId = crypto.randomBytes(8).toString('hex');
  const inputPath = path.join(TEMP_DIR, `${fileId}.mp4`);
  const outputPath = path.join(TEMP_DIR, `${fileId}.gif`);

  try {
    // 1. Download the MP4
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(inputPath, buffer);

    // 2. Convert to GIF using ffmpeg (max 10 seconds, scaled to max 500px width to keep size down, fps 15)
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .duration(10) // Limit to 10 seconds
        .outputOptions([
          '-vf', 'fps=15,scale=500:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
          '-loop', '0'
        ])
        .toFormat('gif')
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    // 3. Read the converted GIF
    const gifBuffer = fs.readFileSync(outputPath);

    // 4. Cleanup temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    return gifBuffer;
  } catch (error) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    throw error;
  }
}

/**
 * Helper to upload the converted GIF buffer to Discord using a Webhook or Channel.
 * For this bot, we can just send it to the interaction channel temporarily and get the proxy URL.
 */
export async function uploadGifToDiscord(interaction, gifBuffer, filename = 'converted.gif') {
  const attachment = new AttachmentBuilder(gifBuffer, { name: filename });
  
  // Send the attachment to the channel where the interaction happened
  const message = await interaction.channel.send({
    content: '*(Internal Processing: Uploading converted GIF)*',
    files: [attachment]
  });

  // Extract the URL
  const attachmentUrl = message.attachments.first().url;
  
  // Delete the temporary message immediately to keep chat clean
  await message.delete().catch(() => null);

  return attachmentUrl;
}
