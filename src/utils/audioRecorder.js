import { joinVoiceChannel, EndBehaviorType, getVoiceConnection } from '@discordjs/voice';
import prism from 'prism-media';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import ffmpeg from 'fluent-ffmpeg';
import { Mixer } from 'audio-mixer';
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

  const mixer = new Mixer({
    channels: 2,
    bitDepth: 16,
    sampleRate: 48000,
    clearInterval: 100
  });
  mixer.pipe(outStream);

  const userInputs = new Map();

  // When a user starts speaking
  receiver.speaking.on('start', (userId) => {
    // Create an Opus stream for the user
    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 100,
      },
    });

    let input = userInputs.get(userId);
    if (!input) {
      input = mixer.input({ channels: 2, bitDepth: 16, sampleRate: 48000 });
      userInputs.set(userId, input);
    }

    // Decode Opus to raw PCM
    const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    opusDecoder.on('error', err => {});
    opusStream.on('error', err => {});
    
    // Pipe the decoded PCM data into their dedicated mixer input
    // We use { end: false } so their mixer channel stays open and perfectly padded with silence when they stop talking
    opusStream.pipe(opusDecoder).on('error', err => {}).pipe(input, { end: false });
  });

  activeRecordings.set(guildId, { connection, receiver, outStream, pcmPath, mixer, startTime: Date.now() });
  return true;
}

export async function stopRecording(guildId) {
  const session = activeRecordings.get(guildId);
  if (!session) return null;

  session.connection.destroy();
  if (session.mixer) session.mixer.destroy();
  session.outStream.end();
  activeRecordings.delete(guildId);

  try {
    const stats = fs.statSync(session.pcmPath);
    if (stats.size === 0) {
      fs.unlink(session.pcmPath, () => {});
      return Promise.reject(new Error('No speech or audio was detected.'));
    }
  } catch (e) {
    return Promise.reject(new Error('Failed to read audio file.'));
  }

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
        resolve({ mp3Path, startTime: session.startTime, durationMs: Date.now() - session.startTime });
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



