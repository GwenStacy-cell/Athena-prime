import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

if (!js.includes("wipeemojisCmds")) {
  js = js.replace(
    "import { commands as enukeCmds } from './enuke.js';",
    "import { commands as enukeCmds } from './enuke.js';\nimport { commands as wipeemojisCmds } from './wipeemojis.js';"
  );
  
  js = js.replace(
    "...enukeCmds,",
    "...enukeCmds,\n    ...wipeemojisCmds,"
  );
  
  fs.writeFileSync("src/commands/loader.js", js);
  console.log("Registered wipeemojis in loader.js!");
}
