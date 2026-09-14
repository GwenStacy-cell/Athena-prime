import fs from 'fs';
let js = fs.readFileSync('src/commands/loader.js', 'utf8');
js = js.replace("import { commands as backupCmds } from './backup.js';", "import { commands as backupCmds } from './backup.js';\nimport { commands as communityCmds } from './community.js';");
js = js.replace("...backupCmds,", "...backupCmds,\n  ...communityCmds,");
fs.writeFileSync('src/commands/loader.js', js);
console.log('Done');
