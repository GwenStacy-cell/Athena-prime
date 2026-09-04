import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

const importTarget = `import { commands as ccmdCmds } from './ccmd.js';`;
const importReplace = `import { commands as ccmdCmds } from './ccmd.js';\nimport { commands as qrCmds } from './qr.js';\nimport { commands as backupCmds } from './backup.js';`;

const arrayTarget = `const allCommands = [\n  ...ccmdCmds,`;
const arrayReplace = `const allCommands = [\n  ...ccmdCmds,\n  ...qrCmds,\n  ...backupCmds,`;

js = js.replace(importTarget, importReplace);
js = js.replace(arrayTarget, arrayReplace);

fs.writeFileSync("src/commands/loader.js", js);
