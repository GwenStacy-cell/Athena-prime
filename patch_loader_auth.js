import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

// Import
js = js.replace("import { commands as botvoiceCmds } from './botvoice.js';", "import { commands as botvoiceCmds } from './botvoice.js';\nimport { commands as authCmds } from './auth.js';");

// Export array
js = js.replace("...botvoiceCmds,", "...botvoiceCmds,\n  ...authCmds,");

fs.writeFileSync("src/commands/loader.js", js);
