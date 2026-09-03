import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

// Remove TTS from voice
const regexVoice = /'`!unsethomevc` - Clear Home VC and disconnect the bot `\[extra owners\]`', '', '`!tts` `<message>` \/ \*\*stop\*\* - Speak in VC `\[public\]`', '`!tts` \*\*lang\*\* \/ \*\*voice\*\* - Change your voice profile `\[public\]`', '`!tts` \*\*auto\*\* \/ \*\*unauto\*\* `@user` - Lock user to Auto-TTS `\[admin\]`'/g;

js = js.replace(regexVoice, "'`!unsethomevc` - Clear Home VC and disconnect the bot `[extra owners]`'");

// Add TTS before welcome
const regexWelcome = /{\s*id:\s*'welcome',/g;
js = js.replace(regexWelcome, "{ id: 'tts', shortLabel: 'TTS', label: 'Text to Speech System', emoji: '<:voice_join_to_create:1523770607706308658>', commands: ['`!tts` `<message>` / **stop** - Speak in VC `[public]`', '`!tts` **lang** / **voice** - Change your voice profile `[public]`', '`!tts` **auto** / **unauto** `@user` - Lock user to Auto-TTS `[admin]`'] },\n    { id: 'welcome',");

fs.writeFileSync("src/commands/utility.js", js);
