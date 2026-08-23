import fs from 'fs';
let code = fs.readFileSync('src/utils/audioRecorder.js', 'utf8');

code = code.replace(`    const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    
    // We pipe the decoded PCM data into our single outStream
    opusStream.pipe(opusDecoder).on('data', (chunk) => {`, `    const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    opusDecoder.on('error', err => {});
    opusStream.on('error', err => {});
    
    // We pipe the decoded PCM data into our single outStream
    opusStream.pipe(opusDecoder).on('error', err => {}).on('data', (chunk) => {`);

fs.writeFileSync('src/utils/audioRecorder.js', code);
