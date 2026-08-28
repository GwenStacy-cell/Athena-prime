import fs from "fs";
let code = fs.readFileSync("src/utils/audioRecorder.js", "utf8");

// Add startTime
code = code.replace(/activeRecordings\.set\(guildId, \{ connection, receiver, outStream, pcmPath, mixer \}\);/g, 
  "activeRecordings.set(guildId, { connection, receiver, outStream, pcmPath, mixer, startTime: Date.now() });");

// Return startTime and duration
code = code.replace(/resolve\(mp3Path\);/g, 
  "resolve({ mp3Path, startTime: session.startTime, durationMs: Date.now() - session.startTime });");

fs.writeFileSync("src/utils/audioRecorder.js", code);
console.log("Updated audioRecorder.js!");
