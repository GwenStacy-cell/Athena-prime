import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

// Import
js = js.replace("import { commands as authCmds } from './auth.js';", "import { commands as authCmds } from './auth.js';\nimport { commands as tierCmds } from './tier.js';");

// Export array
js = js.replace("...authCmds,", "...authCmds,\n  ...tierCmds,");

fs.writeFileSync("src/commands/loader.js", js);
