import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace(
  "`!unsethomevc` - Clear Home VC and disconnect the bot `[extra owners]`'",
  "`!unsethomevc` - Clear Home VC and disconnect the bot `[extra owners]`', '', '`!tts` `<message>` / **stop** - Speak in VC `[public]`', '`!tts` **lang** / **voice** - Change your voice profile `[public]`', '`!tts` **auto** / **unauto** `@user` - Lock user to Auto-TTS `[admin]`'"
);

fs.writeFileSync("src/commands/utility.js", js);
