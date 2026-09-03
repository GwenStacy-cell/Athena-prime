import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

const importTarget = `import { commands as verifyCmds } from './verify.js';`;
const importReplace = `import { commands as verifyCmds } from './verify.js';\nimport { commands as ccmdCmds } from './ccmd.js';`;

const arrayTarget = `const allCommands = [`;
const arrayReplace = `const allCommands = [\n  ...ccmdCmds,`;

js = js.replace(importTarget, importReplace);
js = js.replace(arrayTarget, arrayReplace);

fs.writeFileSync("src/commands/loader.js", js);
