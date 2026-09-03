import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace(
  "'`!tts` **auto** / **unauto** `@user` - Lock user to Auto-TTS `[admin]`'",
  "'`!tts` **auto** / **unauto** `[@user]` - Lock user to Auto-TTS `[public/admin]`', '`!tts` **autovc** - Toggle global Auto-TTS for your current VC `[admin]`'"
);

fs.writeFileSync("src/commands/utility.js", js);
