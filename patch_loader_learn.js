import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

js = js.replace(
  /import \{ commands as appCmds \} from '\.\/app\.js';/g,
  `import { commands as appCmds } from './app.js';\nimport { commands as learnCmds } from './learn.js';`
);

js = js.replace(
  /\.\.\.appCmds,/g,
  `...appCmds,\n  ...learnCmds,`
);

fs.writeFileSync("src/commands/loader.js", js);
