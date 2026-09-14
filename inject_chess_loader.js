import fs from 'fs';
let js = fs.readFileSync('src/commands/loader.js', 'utf8');
js = js.replace("import { commands as backupCmds } from './backup.js';\nimport { commands as communityCmds } from './community.js';", "import { commands as backupCmds } from './backup.js';\nimport { commands as communityCmds } from './community.js';\nimport { commands as chessCmds } from './chess.js';");
js = js.replace("...backupCmds,\n  ...communityCmds,", "...backupCmds,\n  ...communityCmds,\n  ...chessCmds,");
fs.writeFileSync('src/commands/loader.js', js);
console.log('Loader updated');
