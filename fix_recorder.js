import fs from 'fs';
let code = fs.readFileSync('src/utils/audioRecorder.js', 'utf8');

code = code.replace(`  // When a user starts speaking
  receiver.speaking.on('start', (userId) => {
    // Create an Opus stream for the user
    const opusStream = receiver.subscribe(userId, {`, `  let recordingUserId = null;
  // When a user starts speaking
  receiver.speaking.on('start', (userId) => {
    // Only record one user at a time to prevent PCM byte interleaving corruption
    if (recordingUserId && recordingUserId !== userId) return;
    recordingUserId = userId;

    // Create an Opus stream for the user
    const opusStream = receiver.subscribe(userId, {`);

fs.writeFileSync('src/utils/audioRecorder.js', code);
