import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

const t = `import * as appCmds from './app.js';`;
const r = `import * as appCmds from './app.js';\nimport * as ccmdCmds from './ccmd.js';`;

const t2 = `register(appCmds);`;
const r2 = `register(appCmds);\nregister(ccmdCmds);`;

js = js.replace(t, r);
js = js.replace(t2, r2);
fs.writeFileSync("src/commands/loader.js", js);
