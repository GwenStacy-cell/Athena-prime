import fs from "fs";
let js = fs.readFileSync("src/commands/tts.js", "utf8");

js = js.replace(
  "\`!tts <message>\` - Speak in voice channel\\n\`!tts stop\` - Stop current speech\\n\`!tts lang <code|name>\` - Set your default language\\n\`!tts auto @user\` - Enable auto-TTS for a user\\n\`!tts unauto @user\` - Disable auto-TTS",
  "\`!tts <message>\` - Speak in voice channel\\n\`!tts stop\` - Stop current speech\\n\`!tts lang <language>\` - Set language (e.g. \`english\`, \`uk\`, \`au\`, \`es\`, \`ja\`)\\n\`!tts auto [@user]\` - Lock a user to Auto-TTS\\n\`!tts unauto [@user]\` - Disable Auto-TTS\\n\`!tts autovc\` - Toggle global Auto-TTS for your VC"
);

fs.writeFileSync("src/commands/tts.js", js);

let helpJs = fs.readFileSync("src/commands/utility.js", "utf8");

helpJs = helpJs.replace(
  "commands: ['`!tts` `<message>` / **stop** - Speak in VC `[public]`', '`!tts` **lang** / **voice** - Change your voice profile `[public]`', '`!tts` **auto** / **unauto** `[@user]` - Lock user to Auto-TTS `[public/admin]`', '`!tts` **autovc** - Toggle global Auto-TTS for your current VC `[admin]`']",
  "commands: ['`!tts` `<message>` / **stop** - Speak in VC `[public]`', '`!tts` **lang** `<code|name>` - Set language (e.g., `english`, `uk`, `au`, `es`, `ja`) `[public]`', '`!tts` **auto** / **unauto** `[@user]` - Lock user to Auto-TTS `[public/admin]`', '`!tts` **autovc** - Toggle global Auto-TTS for your current VC `[admin]`']"
);

fs.writeFileSync("src/commands/utility.js", helpJs);
