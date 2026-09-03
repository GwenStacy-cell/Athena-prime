import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

js = js.replace("import { commands as npCmds } from './np.js';", "import { commands as npCmds } from './np.js';\nimport { commands as ignoreCmds } from './ignore.js';");
js = js.replace("  ...npCmds,", "  ...npCmds,\n  ...ignoreCmds,");

fs.writeFileSync("src/commands/loader.js", js);
