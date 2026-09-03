import fs from "fs";
let js = fs.readFileSync("src/commands/tts.js", "utf8");

const oldCode = /return message\.reply\(cv2\.warn\('TTS System Usage',\s*`[^`]+`\)\);/;
const newCode = "return message.reply(cv2.warn('TTS System Usage', `\\`!tts <message>\\` - Speak in voice channel\\n\\`!tts stop\\` - Stop current speech\\n\\`!tts lang <language>\\` - Set language (e.g. \\`english\\`, \\`uk\\`, \\`au\\`, \\`es\\`, \\`ja\\`)\\n\\`!tts auto [@user]\\` - Lock a user to Auto-TTS\\n\\`!tts unauto [@user]\\` - Disable Auto-TTS\\n\\`!tts autovc\\` - Toggle global Auto-TTS for your VC`));";

js = js.replace(oldCode, newCode);
fs.writeFileSync("src/commands/tts.js", js);
