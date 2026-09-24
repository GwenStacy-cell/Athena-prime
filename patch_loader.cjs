const fs = require('fs');
let code = fs.readFileSync('src/commands/loader.js', 'utf8');

code = code.replace(
  "import { commands as botgrowthCmds } from './botgrowth.js';",
  "import { commands as botgrowthCmds } from './botgrowth.js';\nimport { commands as buildserverCmds } from './buildserver.js';"
);

code = code.replace(
  "...botgrowthCmds,",
  "...botgrowthCmds,\n  ...buildserverCmds,"
);

fs.writeFileSync('src/commands/loader.js', code);
console.log('Added buildserver to loader.js!');
