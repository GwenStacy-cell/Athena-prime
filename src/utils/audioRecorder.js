import { joinVoiceChannel, EndBehaviorType, getVoiceConnection } from '@discordjs/voice';
import prism from 'prism-media';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
ffmpeg.setFfmpegPath(ffmpegStatic);
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scratchDir = path.join(__dirname, '..', '..', 'scratch');

if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

// Map of guildId -> { connection, receiver, outStream, pcmFile }
const activeRecordings = new Map();

export async function startRecording(vc) {
  const guildId = vc.guild.id;
  if (activeRecordings.has(guildId)) {
    throw new Error('A recording is already active in this server.');
  }

  const connection = joinVoiceChannel({
    channelId: vc.id,
    guildId: vc.guild.id,
    adapterCreator: vc.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: true,
  });

  const receiver = connection.receiver;
  const pcmPath = path.join(scratchDir, `recording_${guildId}_${Date.now()}.pcm`);
  const outStream = createWriteStream(pcmPath, { flags: 'a' });

  // When a user starts speaking
  receiver.speaking.on('start', (userId) => {
    // Create an Opus stream for the user
    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 100,
      },
    });

    // Decode Opus to raw PCM and pipe to our output file
    const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    opusDecoder.on('error', err => {});
    opusStream.on('error', err => {});
    
    // We pipe the decoded PCM data into our single outStream
    opusStream.pipe(opusDecoder).on('error', err => {}).on('data', (chunk) => {
      if (outStream.writable) {
        outStream.write(chunk);
      }
    });
  });

  activeRecordings.set(guildId, { connection, receiver, outStream, pcmPath });
  return true;
}

export async function stopRecording(guildId) {
  const session = activeRecordings.get(guildId);
  if (!session) return null;

  session.connection.destroy();
  session.outStream.end();
  activeRecordings.delete(guildId);

  const mp3Path = session.pcmPath.replace('.pcm', '.mp3');

  return new Promise((resolve, reject) => {
    ffmpeg(session.pcmPath)
      .inputOptions([
        '-f s16le',
        '-ar 48000',
        '-ac 2'
      ])
      .output(mp3Path)
      .audioCodec('libmp3lame')
      .on('end', () => {
        // Cleanup PCM file
        fs.unlink(session.pcmPath, () => {});
        resolve(mp3Path);
      })
      .on('error', (err) => {
        console.error('FFMPEG Error:', err);
        reject(err);
      })
      .run();
  });
}

export function getRecordingStatus(guildId) {
  return activeRecordings.has(guildId);
}


