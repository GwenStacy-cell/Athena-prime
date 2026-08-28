import fs from 'fs';
let code = fs.readFileSync('src/commands/loader.js', 'utf8');

const importStr = "import { commands as topCmds } from './top.js';";
const newImportStr = "import { commands as topCmds } from './top.js';\nimport { commands as invitelbCmds } from './invitelb.js';";
code = code.replace(importStr, newImportStr);

const arrayStr = "...topCmds,";
const newArrayStr = "...topCmds,\n  ...invitelbCmds,";
code = code.replace(arrayStr, newArrayStr);

fs.writeFileSync('src/commands/loader.js', code);
