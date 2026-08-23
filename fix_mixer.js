import fs from 'fs';

let code = fs.readFileSync('src/utils/audioRecorder.js', 'utf8');

// Replace imports
code = code.replace("import ffmpeg from 'fluent-ffmpeg';", "import ffmpeg from 'fluent-ffmpeg';\nimport { Mixer } from 'audio-mixer';");

// Replace startRecording logic
code = code.replace(/  const outStream = createWriteStream\(pcmPath, \{ flags: 'a' \}\);[\s\S]*?activeRecordings\.set\(guildId, \{ connection, receiver, outStream, pcmPath \}\);/g, `  const outStream = createWriteStream(pcmPath, { flags: 'a' });

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

  activeRecordings.set(guildId, { connection, receiver, outStream, pcmPath, mixer });`);

code = code.replace("  session.outStream.end();\n  activeRecordings.delete(guildId);", "  if (session.mixer) session.mixer.destroy();\n  session.outStream.end();\n  activeRecordings.delete(guildId);");

fs.writeFileSync('src/utils/audioRecorder.js', code);
