import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

js = js.replace("import { commands as ttsCmds } from './tts.js';", "import { commands as ttsCmds } from './tts.js';\nimport { commands as quoteCmds } from './quote.js';");
js = js.replace("  ...ttsCmds,", "  ...ttsCmds,\n  ...quoteCmds,");

fs.writeFileSync("src/commands/loader.js", js);
