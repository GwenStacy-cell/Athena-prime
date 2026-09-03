import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

js = js.replace("import { commands as ignoreCmds } from './ignore.js';", "import { commands as ignoreCmds } from './ignore.js';\nimport { commands as ttsCmds } from './tts.js';");
js = js.replace("  ...ignoreCmds,", "  ...ignoreCmds,\n  ...ttsCmds,");

fs.writeFileSync("src/commands/loader.js", js);
