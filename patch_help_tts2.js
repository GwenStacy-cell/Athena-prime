import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

// Remove it from Voice
js = js.replace(
  "`!unsethomevc` - Clear Home VC and disconnect the bot `[extra owners]`', '', '`!tts` `<message>` / **stop** - Speak in VC `[public]`', '`!tts` **lang** / **voice** - Change your voice profile `[public]`', '`!tts` **auto** / **unauto** `@user` - Lock user to Auto-TTS `[admin]`'",
  "`!unsethomevc` - Clear Home VC and disconnect the bot `[extra owners]`'"
);

// Add it as a new category after Voice
const newCategory = `    { id: 'tts', shortLabel: 'TTS', label: 'Text to Speech System', emoji: '<:voice_join_to_create:1523770607706308658>', commands: [
      '\`!tts\` \`<message>\` / **stop** - Speak in VC \`[public]\`', 
      '\`!tts\` **lang** / **voice** - Change your voice profile \`[public]\`', 
      '\`!tts\` **auto** / **unauto** \`@user\` - Lock user to Auto-TTS \`[admin]\`'
    ] },\n    { id: 'welcome',`;

js = js.replace("    { id: 'welcome',", newCategory);

fs.writeFileSync("src/commands/utility.js", js);
